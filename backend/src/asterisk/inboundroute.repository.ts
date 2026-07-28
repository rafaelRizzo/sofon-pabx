import { prisma } from '../lib/prisma'
import type { InboundDest } from '../modules/inbound-routes/schemas/inbound-route.schema'
import { ROUTING_TRUNK_VAR, recordingFilenameSuffix } from './dialplan-names'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'
import { FlowEdgeRepository } from './flow-edge.repository'

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

type Entry = { context: string; exten: string; priority: number; app: string; appdata: string | null }

function buildInboundEntries(
    exten: string,
    app: string,
    appdata: string | null,
    trunkId: string,
    didNumber: string,
    maxIn: number | null | undefined,
): Entry[] {
    // didNumber vem de Did.number, validado por regex ^\d+$ (ver did.schema.ts) — seguro
    // interpolar direto no appdata, sem risco de injeção no dialplan
    const mixmonitorFilename =
        '/var/spool/asterisk/monitor/${CHANNEL(accountcode)}/${STRFTIME(${EPOCH},,%Y/%m/%d)}/' +
        recordingFilenameSuffix('${CALLERID(num)}', didNumber)

    const entries: Entry[] = []
    let priority = 1
    const push = (stepApp: string, stepAppdata: string | null) => {
        entries.push({ context: TRUNK_ROUTED_CONTEXT, exten, priority: priority++, app: stepApp, appdata: stepAppdata })
    }

    push('Set', `${ROUTING_TRUNK_VAR}=${trunkId}`)
    // Enriquecimento de CDR — persiste no canal do ligante e sobrevive a qualquer Goto
    // intermediário (timecondition/holiday/ivr/queue/extension) até o Dial final
    push('Set', 'CDR(direction)=inbound')
    push('Set', `CDR(trunk_id)=${trunkId}`)
    push('Set', `CDR(dialed_number)=${didNumber}`)

    let gotoIfIndex = -1
    if (maxIn != null) {
        push('Set', `GROUP()=in-${trunkId}`)
        gotoIfIndex = entries.length
        push('GotoIf', '') // appdata corrigido depois, quando sabemos a priority do Congestion
    }

    push('Answer', null)
    // Grava desde a entrada — mesmo padrão de dialplan.repository.ts (ramais/internal), só que
    // sem alias de ramal: usa o número do DID discado como identificador no nome do arquivo
    push('Set', `MIXMONITOR_FILENAME=${mixmonitorFilename}`)
    push('MixMonitor', '${MIXMONITOR_FILENAME},b')
    push('Set', 'CDR(recording_file)=${MIXMONITOR_FILENAME}')
    push(app, appdata)

    if (maxIn != null) {
        const congestionPriority = priority
        entries[gotoIfIndex]!.appdata = `$[\${GROUP_COUNT(in-${trunkId})} > ${maxIn}]?${congestionPriority}`
        push('Congestion', null)
    }

    return entries
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

    // Regera o dialplan de TODAS as inbound routes da empresa a partir do template atual — cobre
    // rotas criadas antes de uma mudança de template (ex: novos campos de CDR, gravação) que nunca
    // foram salvas de novo via update() desde então. Usado por resyncDialplan (companies.service.ts).
    async regenerateAll(companyId: string) {
        const routes = await prisma.inboundRoute.findMany({
            where: { companyId },
            select: { id: true, trunkId: true, did: { select: { number: true } }, trunk: { select: { maxInChannels: true } } },
        })
        if (routes.length === 0) return

        const edges = await FlowEdgeRepository.getBySource(companyId, 'inboundroute')

        await prisma.$transaction(async (tx) => {
            for (const route of routes) {
                const dest = edges.get(route.id)?.default ?? null
                await this.update(tx, route.trunkId, route.did.number, dest, route.trunk.maxInChannels)
            }
        })
    },
}
