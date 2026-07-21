import { prisma } from '../lib/prisma'
import { validateEnv } from '../config/env'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'
import { audioSoundPath } from './audio.repository'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'
import { FlowEdgeRepository } from './flow-edge.repository'
import { nodeExitCheck } from './flow-node-runtime'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const env = validateEnv()

export const QUEUE_APP_CONTEXT = 'queues-app'

// `number` é a identidade operacional da fila; `name` é só o rótulo editável exibido na UI.
// Assim, reutilizar a Fila 600 em vários nós nunca cria nem renomeia uma segunda fila no Asterisk.
export const toAsteriskQueueName = (asteriskId: string, queueNumber: string) => `${asteriskId}-${queueNumber}`
export const queueAppExten = (asteriskId: string, number: string) => `${asteriskId}-${number}`

export const toAsteriskInterface = (type: string, number: string) => `${type.toUpperCase()}/${number}`

// Inverso de toAsteriskInterface: "PJSIP/2002_ast1" -> { type: 'pjsip',
// number: '2002_ast1' }. MEMBERINTERFACE (setado nativamente pelo Queue() no canal do caller após
// o bridge) vem exatamente nesse formato, sem sufixo de canal (diferente de nome de canal tipo
// "PJSIP/2002_ast1-00000a1b") — não precisa strip de sufixo hex.
export function parseMemberInterface(iface: string): { type: string; number: string } | null {
    const idx = iface.indexOf('/')
    if (idx === -1) return null
    return { type: iface.slice(0, idx).toLowerCase(), number: iface.slice(idx + 1) }
}

// AGI de pré-roteamento (seta QUEUE_PRIO a partir de RoutingRule, ver handleQueueRoute em agi-server.ts)
// e AGI de pós-fila (captura MEMBERINTERFACE pra pesquisa de satisfação, ver handleQueueSurvey) —
// mesmo padrão de buildAgiUrl de request-template.repository.ts, só variando o script.
const buildQueueRouteAgiUrl = (queueId: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/queue-route,${queueId}`
const buildQueueSurveyAgiUrl = (queueId: string) => `agi://${env.AGI_HOST}:${env.AGI_PORT}/queue-survey,${queueId}`

// Pra onde o cliente vai quando a fila termina sem ele ter desligado (timeout, sem agente, ou
// agente desliga primeiro) — mesmo RouteDestination usado por Inbound Routes/Time Conditions
async function resolvePostQueueDestination(dest: RouteDestination): Promise<{ app: string; appdata: string | null }> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? { app: 'Goto', appdata: `${target.context},${target.exten},${target.priority}` } : { app: 'Hangup', appdata: null }
}

type AsteriskQueueData = {
    strategy?: string
    musicOnHold?: string
    timeout?: number
    retry?: number
    maxLen?: number
    wrapupTime?: number
    // `announce` aqui é o `announce` NATIVO de queues.conf/tabela realtime — tocado pro AGENTE
    // antes do bridge (agent announcement), resolvido a partir de Queue.agentAnnounce pelo
    // service. O "join announcement" (Queue.announce, tocado pro caller ao entrar) é um Playback
    // no dialplan antes do Queue() (ver regenerate() abaixo), não essa coluna
    announce?: string | null
    announceFrequency?: number
    announcePosition?: boolean
    periodicAnnounce?: string | null
    periodicAnnounceFrequency?: number
    joinEmpty?: boolean
    leaveWhenEmpty?: boolean
    weight?: number
}

export const AsteriskQueueRepository = {
    async createQueue(tx: Tx, asteriskName: string, data: AsteriskQueueData) {
        await tx.queues.create({
            data: {
                name: asteriskName,
                strategy: data.strategy,
                musiconhold: data.musicOnHold,
                timeout: data.timeout,
                retry: data.retry,
                maxlen: data.maxLen,
                wrapuptime: data.wrapupTime,
                announce: data.announce ?? null,
                announceFreq: data.announceFrequency,
                announcePosition: data.announcePosition ? 'yes' : 'no',
                periodicAnnounce: data.periodicAnnounce ?? null,
                periodicAnnounceFreq: data.periodicAnnounceFrequency,
                joinempty: data.joinEmpty ? 'yes' : 'no',
                leavewhenempty: data.leaveWhenEmpty ? 'yes' : 'no',
                weight: data.weight,
            },
        })
    },

    // upsert em vez de update: a linha realtime pode ter sido perdida (drift entre `Queue` e
    // `queues` — ex: reset manual do banco) sem que o registro do app deixe de existir; recriar
    // com os campos default do Asterisk (ver schema.prisma) é mais seguro que 500 num PUT normal.
    async updateQueue(tx: Tx, asteriskName: string, update: Record<string, any>) {
        if (Object.keys(update).length > 0)
            await tx.queues.upsert({
                where: { name: asteriskName },
                update,
                create: { name: asteriskName, ...update },
            })
    },

    // updateMany não lança se `oldName` já não existir (linha ausente por drift) — segue como
    // no-op, e o updateQueue() logo em seguida recria a linha já com `newAsteriskName`.
    async renameQueue(tx: Tx, oldName: string, newName: string) {
        await tx.queue_members.updateMany({
            where: { queue_name: oldName },
            data: { queue_name: newName },
        })
        await tx.queues.updateMany({ where: { name: oldName }, data: { name: newName } })
    },

    async deleteQueue(tx: Tx, asteriskName: string) {
        await tx.queue_members.deleteMany({ where: { queue_name: asteriskName } })
        await tx.queues.deleteMany({ where: { name: asteriskName } })
    },

    async deleteManyQueues(tx: Tx, asteriskNames: string[]) {
        if (asteriskNames.length > 0) {
            await tx.queue_members.deleteMany({ where: { queue_name: { in: asteriskNames } } })
            await tx.queues.deleteMany({ where: { name: { in: asteriskNames } } })
        }
    },

    async addMember(tx: Tx, asteriskQueueName: string, iface: string, opts: { memberName: string, penalty: number, paused: boolean }) {
        await tx.queue_members.create({
            data: {
                queue_name: asteriskQueueName,
                interface: iface,
                membername: opts.memberName,
                state_interface: iface,
                penalty: opts.penalty,
                paused: opts.paused ? 1 : 0,
            },
        })
    },

    async updateMember(tx: Tx, asteriskQueueName: string, iface: string, data: { penalty?: number, paused?: boolean, pauseReason?: string | null }) {
        const update: Record<string, any> = {}
        if (data.penalty !== undefined) update.penalty = data.penalty
        if (data.paused !== undefined) {
            update.paused = data.paused ? 1 : 0
            update.reason_paused = data.paused ? (data.pauseReason ?? null) : null
        } else if (data.pauseReason !== undefined) {
            update.reason_paused = data.pauseReason
        }
        if (Object.keys(update).length > 0)
            await tx.queue_members.update({
                where: { queue_name_interface: { queue_name: asteriskQueueName, interface: iface } },
                data: update,
            })
    },

    async removeMember(tx: Tx, asteriskQueueName: string, iface: string) {
        await tx.queue_members.deleteMany({ where: { queue_name: asteriskQueueName, interface: iface } })
    },

    async removeMembersByInterfaces(tx: Tx, interfaces: string[]) {
        if (interfaces.length > 0)
            await tx.queue_members.deleteMany({ where: { interface: { in: interfaces } } })
    },

    async updateMemberInterfaces(tx: Tx, oldIface: string, newIface: string) {
        await tx.queue_members.updateMany({
            where: { interface: oldIface },
            data: { interface: newIface, state_interface: newIface },
        })
    },

    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de Queue (nome, número ou
    // postQueueDestination). exten de cada fila é `<asteriskId>-<number>` (queueAppExten).
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${QUEUE_APP_CONTEXT}:${asteriskId}`, async () => {
            const [queues, edges] = await Promise.all([
                prisma.queue.findMany({ where: { companyId } }),
                FlowEdgeRepository.getBySource(companyId, 'queue'),
            ])
            const entries: DialplanRow[] = []
            for (const q of queues) {
                if (!q.number) continue
                const exten = queueAppExten(asteriskId, q.number)
                const asteriskName = toAsteriskQueueName(asteriskId, q.number)
                const { app, appdata } = await resolvePostQueueDestination(edges.get(q.id)?.default ?? null)

                // callcenterEnabled=false: fila roda 100% nativa, sem o AGI de pré-roteamento
                // (RoutingRule/QUEUE_PRIO) — pesquisa (priority AGI queue-survey) segue independente,
                // gated pelo próprio surveyAudioId dentro do handler
                let priority = 1
                if (q.callcenterEnabled)
                    entries.push({ context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'AGI', appdata: buildQueueRouteAgiUrl(q.id) })
                // Anúncio tocado uma única vez pro caller antes de entrar na fila — Playback direto
                // no dialplan, não o `announce` nativo do Asterisk (esse é pro agente, ver acima)
                if (q.announce)
                    entries.push({ context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'Playback', appdata: audioSoundPath(asteriskId, q.announce) })
                entries.push(
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'Queue', appdata: asteriskName },
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'AGI', appdata: buildQueueSurveyAgiUrl(q.id) },
                    nodeExitCheck(QUEUE_APP_CONTEXT, exten, priority++, 'default'),
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app, appdata },
                )
            }
            await writeContextFile(QUEUE_APP_CONTEXT, asteriskId, entries)
            // FlowNodes guardam uma entrada por instância e ela contém o número da fila. Recompila
            // também quando uma fila muda de número, sem nunca recriar o recurso realtime.
            const { FlowNodeRepository } = await import('./flow-node.repository')
            await FlowNodeRepository.regenerate(companyId)
            reloadDialplan()
        })
    },
}
