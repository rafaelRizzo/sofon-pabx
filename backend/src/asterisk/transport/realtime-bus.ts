import { EventEmitter } from 'node:events'
import { redisClient } from '../../config/redis'
import { logger } from '../../utils/logger'

export type RealtimeChangeKind = 'extension' | 'trunk' | 'queue'

// EventEmitter in-process pra entrega instantânea dentro do MESMO processo (dev local, PROCESS_ROLE
// 'all') - mas em produção escalada (ver backend/CLAUDE.md, "Escalar backend em réplicas") AMI
// events roda no processo 'worker' e as rotas SSE de realtime.routes.ts rodam nas réplicas 'web' -
// processos SEPARADOS, cada um com seu próprio EventEmitter em memória. Sem o pub/sub Redis abaixo,
// emitRealtimeChange() chamado no worker nunca chegava às réplicas web: elas só recebiam o snapshot
// inicial da conexão + heartbeat (`:\n\n` a cada 25s), nunca um push de mudança de verdade -
// diagnosticado via probe direto no SSE em produção (curl -N não via nenhum "data:" novo em 40s
// além do heartbeat, mesmo com o registro do tronco sendo reconfirmado a cada 30s no worker).
export const realtimeBus = new EventEmitter()
realtimeBus.setMaxListeners(0) // 1 listener por conexão SSE aberta, N simultâneas é normal

const CHANNEL = 'realtime:change'
let publisher: ReturnType<typeof redisClient.duplicate> | null = null
let subscriber: ReturnType<typeof redisClient.duplicate> | null = null

async function getPublisher() {
    if (!publisher) {
        publisher = redisClient.duplicate()
        publisher.on('error', (error) => logger.warn({ event: 'realtime.bus.publisher.error', message: error.message }))
    }
    if (!publisher.isOpen) await publisher.connect()
    return publisher
}

// Fire-and-forget nos chamadores (nenhum call site em ami-events.ts dá await nisso, igual sempre
// foi com o EventEmitter puro) - falha de publish vira warning, nunca derruba o handler AMI que
// chamou. O emit local continua rodando sempre, então PROCESS_ROLE=all nunca depende do Redis pra
// se autoatualizar (e no caso raro de eco via subscriber própria, o debounce de 300ms do SSE já
// coalesce os dois emits numa única query).
export async function emitRealtimeChange(kind: RealtimeChangeKind): Promise<void> {
    realtimeBus.emit('change', kind)
    try {
        const pub = await getPublisher()
        await pub.publish(CHANNEL, kind)
    } catch (error) {
        logger.warn({ event: 'realtime.bus.publish_failed', message: error instanceof Error ? error.message : String(error) })
    }
}

// Chamado uma vez no boot de qualquer processo que sirva rotas SSE (PROCESS_ROLE web/all, ver
// server.ts) - assina o canal Redis e repassa pro EventEmitter local, que é o que
// realtime.sse.ts já escuta. Sem isso reconecta sozinho não adianta nada: o client duplicado
// precisa ter sido conectado/assinado pelo menos uma vez por processo.
export async function startRealtimeBusSubscriber(): Promise<void> {
    if (subscriber) return
    subscriber = redisClient.duplicate()
    subscriber.on('error', (error) => logger.warn({ event: 'realtime.bus.subscriber.error', message: error.message }))
    await subscriber.connect()
    await subscriber.subscribe(CHANNEL, (kind) => {
        realtimeBus.emit('change', kind as RealtimeChangeKind)
    })
    logger.info({ event: 'realtime.bus.subscriber.started' })
}

export async function stopRealtimeBusSubscriber(): Promise<void> {
    if (subscriber) {
        await subscriber.quit().catch(() => undefined)
        subscriber = null
    }
    if (publisher) {
        await publisher.quit().catch(() => undefined)
        publisher = null
    }
}
