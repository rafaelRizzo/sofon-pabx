import { prisma } from '../lib/prisma'
import type { InboundDest } from '../modules/inbound-routes/schemas/inbound-route.schema'
import { ROUTING_TRUNK_VAR } from './dialplan-names'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function resolveDestination(dest: InboundDest): Promise<{ app: string; appdata: string | null }> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? { app: 'Goto', appdata: `${target.context},${target.exten},${target.priority}` } : { app: 'Hangup', appdata: null }
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
    didNumber: string,
    maxIn: number | null | undefined,
): Array<{ context: string; exten: string; priority: number; app: string; appdata: string | null }> {
    // Enriquecimento de CDR — persiste no canal do ligante e sobrevive a qualquer Goto
    // intermediário (timecondition/holiday/ivr/queue/extension) até o Dial final
    const cdrEntries = [
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 2, app: 'Set', appdata: 'CDR(direction)=inbound' },
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 3, app: 'Set', appdata: `CDR(trunk_id)=${trunkId}` },
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 4, app: 'Set', appdata: `CDR(dialed_number)=${didNumber}` },
    ]
    if (maxIn != null) {
        return [
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 1, app: 'Set', appdata: `${ROUTING_TRUNK_VAR}=${trunkId}` },
            ...cdrEntries,
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 5, app: 'Set', appdata: `GROUP()=in-${trunkId}` },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 6, app: 'GotoIf', appdata: `$[\${GROUP_COUNT(in-${trunkId})} > ${maxIn}]?9` },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 7, app: 'Answer', appdata: null },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 8, app, appdata },
            { context: TRUNK_ROUTED_CONTEXT, exten, priority: 9, app: 'Congestion', appdata: null },
        ]
    }
    return [
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 1, app: 'Set', appdata: `${ROUTING_TRUNK_VAR}=${trunkId}` },
        ...cdrEntries,
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 5, app: 'Answer', appdata: null },
        { context: TRUNK_ROUTED_CONTEXT, exten, priority: 6, app, appdata },
    ]
}

export const InboundRouteRepository = {
    async create(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(trunkId, didNumber)
        const { app, appdata } = await resolveDestination(dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, didNumber, maxIn) })
    },

    async update(tx: Tx, trunkId: string, didNumber: string, dest: InboundDest, maxIn?: number | null) {
        const exten = routedExten(trunkId, didNumber)
        await tx.extensions.deleteMany({ where: { context: TRUNK_ROUTED_CONTEXT, exten } })
        const { app, appdata } = await resolveDestination(dest)
        await tx.extensions.createMany({ data: buildInboundEntries(exten, app, appdata, trunkId, didNumber, maxIn) })
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
