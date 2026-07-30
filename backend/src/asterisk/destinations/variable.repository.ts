import { prisma } from '../../lib/prisma'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import { VAR_CONTEXT, varEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'
import { isSafeDialplanValue } from '../../modules/variables/schemas/variable.schema'
import { nodeExitCheck } from '../flows/flow-node-runtime'

export { VAR_CONTEXT, varEntry }

type Assignment = { variable: string; value: string }

async function resolveTarget(dest: RouteDestination): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(dest)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

// value pode conter interpolação nativa do Asterisk (${OUTRAVAR}) — resolvida em tempo de chamada
// pelo próprio Set(), sem precisar de AGI (diferente de RequestTemplate.variableMappings)
export function buildDialplan(id: string, name: string, assignments: Assignment[], target: string | null): DialplanRow[] {
    const context = VAR_CONTEXT
    const exten = varEntry(id)
    const entries: DialplanRow[] = [{ context, exten, priority: 1, app: 'NoOp', appdata: `VariableSet: ${name}` }]

    let priority = 2
    for (const a of assignments) {
        // Defesa em profundidade para registros legados, criados antes da validação de schema:
        // nunca materializa expressões arbitrárias (ex.: ${SHELL(...)}) no dialplan.
        const value = isSafeDialplanValue(a.value) ? a.value : ''
        entries.push({ context, exten, priority, app: 'Set', appdata: `${a.variable}=${value}` })
        priority++
    }

    entries.push({ context, exten, priority, app: target ? 'Goto' : 'Hangup', appdata: target })
    return entries
}

export const VariableRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de VariableSet.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${VAR_CONTEXT}:${asteriskId}`, async () => {
            const [sets, edges] = await Promise.all([
                prisma.variableSet.findMany({ where: { companyId } }),
                FlowEdgeRepository.getBySource(companyId, 'variableset'),
            ])
            const entries: DialplanRow[] = []
            for (const s of sets) {
                const target = await resolveTarget(edges.get(s.id)?.default ?? null)
                const rows = buildDialplan(s.id, s.name, s.assignments as Assignment[], target)
                const terminal = rows.at(-1)!
                terminal.priority++
                rows.push(nodeExitCheck(VAR_CONTEXT, varEntry(s.id), terminal.priority - 1, 'default'))
                // writeContextFile precisa das prioridades na mesma ordem do exten; move o check
                // imediatamente antes do terminal depois de criá-lo sem alterar o builder puro.
                const check = rows.pop()!
                rows.splice(rows.length - 1, 0, check)
                entries.push(...rows)
            }
            await writeContextFile(VAR_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
