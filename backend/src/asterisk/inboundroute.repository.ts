import { prisma } from '../lib/prisma'
import type { InboundDest } from '../modules/inbound-routes/schemas/inbound-route.schema'
import { queueAppExten } from './queue.repository'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function resolveDestination(tx: Tx, dest: InboundDest): Promise<{ app: string; appdata: string | null }> {
    if (!dest || dest.type === 'hangup') return { app: 'Hangup', appdata: null }

    switch (dest.type) {
        case 'extension': {
            const ext = await tx.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? { app: 'Goto', appdata: `${ext.context},${ext.number},1` } : { app: 'Hangup', appdata: null }
        }
        case 'queue': {
            const q = await tx.queue.findUnique({ where: { id: dest.id }, select: { number: true, company: { select: { asteriskId: true } } } })
            return q?.number
                ? { app: 'Goto', appdata: `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` }
                : { app: 'Hangup', appdata: null }
        }
        case 'voicemail':
            return { app: 'Goto', appdata: `vm,${dest.id},1` }
        case 'timecondition':
            return { app: 'Goto', appdata: `tc-${dest.id},s,1` }
    }
}

// contexto único compartilhado por todas as trunks — ps_endpoints.context de toda trunk inbound
export const TRUNK_ENTRY_CONTEXT = 'from-trunk'
// contexto onde o dialplan real é resolvido, já com TRUNKID (setvar do endpoint) embutido no exten —
// isola trunks/empresas diferentes mesmo quando o mesmo número de DID é reusado entre elas
export const TRUNK_ROUTED_CONTEXT = 'from-trunk-routed'

function routedExten(trunkId: string, didNumber: string) {
    return `${didNumber}_${trunkId}`
}

export const InboundRouteRepository = {
    async create(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest) {
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.create({
            data: { context: TRUNK_ROUTED_CONTEXT, exten: routedExten(trunkId, didNumber), priority: 1, app, appdata },
        })
    },

    async update(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest) {
        const exten = routedExten(trunkId, didNumber)
        await tx.extensions.deleteMany({ where: { context: TRUNK_ROUTED_CONTEXT, exten } })
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.create({ data: { context: TRUNK_ROUTED_CONTEXT, exten, priority: 1, app, appdata } })
    },

    async delete(tx: Tx, trunkId: string, didNumber: string) {
        await tx.extensions.deleteMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: routedExten(trunkId, didNumber) },
        })
    },
}
