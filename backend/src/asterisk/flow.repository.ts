import { prisma } from '../lib/prisma'
import { FLOW_CONTEXT, FLOW_NODE_CONTEXT, flowExten, flowNodeExten } from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from './route-destination-resolver'
import { FlowEdgeRepository } from './flow-edge.repository'

export { FLOW_CONTEXT, flowExten }

async function resolveTarget(dest: Awaited<ReturnType<typeof FlowEdgeRepository.getOne>>): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

export const FlowRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de Flow. 1 linha por Flow:
    // Goto pro entryDestination resolvido, ou Hangup se ainda não configurado.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${FLOW_CONTEXT}:${asteriskId}`, async () => {
            const [flows, edges] = await Promise.all([
                prisma.flow.findMany({ where: { companyId } }),
                FlowEdgeRepository.getBySource(companyId, 'flow'),
            ])
            const entries: DialplanRow[] = []
            for (const f of flows) {
                if (f.entryNodeId) {
                    entries.push({ context: FLOW_CONTEXT, exten: flowExten(f.id), priority: 1, app: 'Goto', appdata: `${FLOW_NODE_CONTEXT},${flowNodeExten(f.entryNodeId)},1` })
                    continue
                }
                const target = await resolveTarget(edges.get(f.id)?.entry ?? null)
                entries.push({ context: FLOW_CONTEXT, exten: flowExten(f.id), priority: 1, app: target ? 'Goto' : 'Hangup', appdata: target })
            }
            await writeContextFile(FLOW_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
