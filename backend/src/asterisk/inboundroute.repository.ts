import { prisma } from '../lib/prisma'
import type { InboundDest } from '../modules/inbound-routes/schemas/inbound-route.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'

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

// contexto único compartilhado por todas as trunks — ps_endpoints.context de toda trunk inbound
export const TRUNK_ENTRY_CONTEXT = 'from-trunk'
// contexto onde o dialplan real é resolvido, já com TRUNKID (setvar do endpoint) embutido no exten —
// isola trunks/empresas diferentes mesmo quando o mesmo número de DID é reusado entre elas
export const TRUNK_ROUTED_CONTEXT = 'from-trunk-routed'

function routedExten(trunkId: string, didNumber: string) {
    return `${didNumber}_${trunkId}`
}

function buildInboundEntries(
    exten: string,
    app: string,
    appdata: string | null,
    trunkId: string,
    maxIn: number | null | undefined,
): Array<{ context: string; exten: string; priority: number; app: string; appdata: string | null }> {
    if (maxIn != null) {
        return [
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 1, app: 'Set', appdata: `GROUP()=in-${trunkId}` },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 2, app: 'GotoIf', appdata: `$[\${GROUP_COUNT(in-${trunkId})} > ${maxIn}]?5` },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 3, app: 'Answer', appdata: null },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 4, app, appdata },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 5, app: 'Congestion', appdata: null },
        ]
    }
    return [
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 1, app: 'Answer', appdata: null },
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 2, app, appdata },
    ]
}

export const InboundRouteRepository = {
    async create(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(trunkId, didNumber)
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, maxIn) })
    },

    async update(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(trunkId, didNumber)
        await tx.extensions.deleteMany({ where: { context: TRUNK_ROUTED_CONTEXT, exten } })
        const { app, appdata } = await resolveDestination(tx, dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, maxIn) })
    },

    async delete(tx: Tx, trunkId: string, didNumber: string) {
        await tx.extensions.deleteMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: routedExten(trunkId, didNumber) },
        })
    },

    async deleteMany(tx: Tx, routes: { trunkId: string; didNumber: string }[]) {
        if (routes.length === 0) return
        await tx.extensions.deleteMany({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: { in: routes.map((r) => routedExten(r.trunkId, r.didNumber)) } },
        })
    },
}
