import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { realtimeBus, type RealtimeChangeKind } from '../../asterisk/realtime-bus'
import { logger } from '../../utils/logger'

const optionalCompanyQuery = z.object({ companyId: z.cuid2().optional() })

// Rajadas de eventos AMI (ex: reconexão que reemite dezenas de ContactStatus de uma vez) colapsam
// num único refetch por conexão — sem isso cada evento dispararia uma query Prisma+Redis por client conectado
const COALESCE_MS = 300
// Mantém proxies reversos (Nginx Proxy Manager, ver backend/CLAUDE.md) de fechar a conexão por inatividade
const HEARTBEAT_MS = 25_000

// Empurra o status (extensions/trunks/queues) assim que muda, em vez do polling REST de 1s que
// existia antes — reaproveita os mesmos service functions (getExtensionsStatus etc.), só troca o
// gatilho de "a cada 1s" pra "quando o realtime-bus avisar que esse tipo de entidade mudou"
export async function streamRealtimeStatus<T>(
    req: FastifyRequest,
    reply: FastifyReply,
    kind: RealtimeChangeKind,
    fetchStatus: (companyIds?: string[]) => Promise<T>,
): Promise<void> {
    const filter = optionalCompanyQuery.safeParse(req.query)
    let companyIds: string[] | undefined
    if (filter.success && filter.data.companyId) {
        req.scope.assertAccess(filter.data.companyId)
        companyIds = [filter.data.companyId]
    } else {
        companyIds = req.scope.companyIds ?? undefined
    }

    reply.hijack()
    const res = reply.raw

    // reply.header(...) (CORS, helmet etc.) só fica guardado no objeto reply até o send() de
    // verdade rodar — como a gente escreve direto em reply.raw, precisa copiar esses headers pra cá
    // ANTES do writeHead, senão o hijack derruba tudo isso (ex: Access-Control-Allow-Origin sumindo
    // e o browser bloqueando a resposta por CORS mesmo o backend respondendo 200)
    for (const [key, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) res.setHeader(key, value as string | number | string[])
    }
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.writeHead(200)

    let closed = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const push = async () => {
        try {
            const data = await fetchStatus(companyIds)
            if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`)
        } catch (error) {
            logger.warn({ event: 'realtime.sse.push_failed', kind, message: error instanceof Error ? error.message : String(error) })
        }
    }

    const schedulePush = () => {
        if (timer) return
        timer = setTimeout(() => {
            timer = undefined
            void push()
        }, COALESCE_MS)
    }

    const onChange = (changedKind: RealtimeChangeKind) => {
        if (changedKind === kind) schedulePush()
    }

    realtimeBus.on('change', onChange)
    const heartbeat = setInterval(() => {
        if (!closed) res.write(':\n\n')
    }, HEARTBEAT_MS)

    req.raw.on('close', () => {
        closed = true
        clearInterval(heartbeat)
        if (timer) clearTimeout(timer)
        realtimeBus.off('change', onChange)
    })

    await push()
}
