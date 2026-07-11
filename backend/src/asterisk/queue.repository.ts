import { prisma } from '../lib/prisma'
import { validateEnv } from '../config/env'
import type { RouteDestination } from '../schemas/route-destination.schema'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const env = validateEnv()

export const QUEUE_APP_CONTEXT = 'queues-app'

export const toAsteriskQueueName = (asteriskId: string, queueName: string) => `${asteriskId}-${queueName}`
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
    if (!dest || dest.type === 'hangup') return { app: 'Hangup', appdata: null }

    switch (dest.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? { app: 'Goto', appdata: `${ext.context},${ext.number},1` } : { app: 'Hangup', appdata: null }
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({ where: { id: dest.id }, select: { number: true, company: { select: { asteriskId: true } } } })
            return q?.number
                ? { app: 'Goto', appdata: `${QUEUE_APP_CONTEXT},${queueAppExten(q.company.asteriskId, q.number)},1` }
                : { app: 'Hangup', appdata: null }
        }
        case 'voicemail':
            return { app: 'Goto', appdata: `vm,${dest.id},1` }
        case 'timecondition':
            return { app: 'Goto', appdata: `${TC_CONTEXT},${tcEntry(dest.id)},1` }
        case 'holiday':
            return { app: 'Goto', appdata: `${HOL_CONTEXT},${holEntry(dest.id)},1` }
        case 'announcement':
            return { app: 'Goto', appdata: `${ANNOUNCEMENT_CONTEXT},${announcementExten(dest.id)},1` }
        case 'ivr':
            return { app: 'Goto', appdata: `${IVR_CONTEXT},${ivrExten(dest.id)},1` }
        case 'request':
            return { app: 'Goto', appdata: `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(dest.id)},1` }
    }
}

type AsteriskQueueData = {
    strategy?: string
    musicOnHold?: string
    timeout?: number
    retry?: number
    maxLen?: number
    wrapupTime?: number
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

    async updateQueue(tx: Tx, asteriskName: string, update: Record<string, any>) {
        if (Object.keys(update).length > 0)
            await tx.queues.update({ where: { name: asteriskName }, data: update })
    },

    async renameQueue(tx: Tx, oldName: string, newName: string) {
        await tx.queue_members.updateMany({
            where: { queue_name: oldName },
            data: { queue_name: newName },
        })
        await tx.queues.update({ where: { name: oldName }, data: { name: newName } })
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
            const queues = await prisma.queue.findMany({ where: { companyId } })
            const entries: DialplanRow[] = []
            for (const q of queues) {
                if (!q.number) continue
                const exten = queueAppExten(asteriskId, q.number)
                const asteriskName = toAsteriskQueueName(asteriskId, q.name)
                const { app, appdata } = await resolvePostQueueDestination(q.postQueueDestination as RouteDestination)

                // callcenterEnabled=false: fila roda 100% nativa, sem o AGI de pré-roteamento
                // (RoutingRule/QUEUE_PRIO) — pesquisa (priority AGI queue-survey) segue independente,
                // gated pelo próprio surveyAudioId dentro do handler
                let priority = 1
                if (q.callcenterEnabled)
                    entries.push({ context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'AGI', appdata: buildQueueRouteAgiUrl(q.id) })
                entries.push(
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'Queue', appdata: asteriskName },
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app: 'AGI', appdata: buildQueueSurveyAgiUrl(q.id) },
                    { context: QUEUE_APP_CONTEXT, exten, priority: priority++, app, appdata },
                )
            }
            await writeContextFile(QUEUE_APP_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
