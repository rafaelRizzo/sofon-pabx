import { prisma } from '../lib/prisma'
import type { RouteDestination } from '../schemas/route-destination.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
    VAR_CONTEXT, varEntry, VARCOND_CONTEXT, varCondEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

export { VAR_CONTEXT, varEntry }

type Assignment = { variable: string; value: string }

// "context,exten,priority" para destinos fora do exten atual, ou null para hangup —
// mesmo contrato de resolveRoute() em timecondition.repository.ts
async function resolveTarget(dest: RouteDestination): Promise<string | null> {
    if (!dest || dest.type === 'hangup') return null

    switch (dest.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({ where: { id: dest.id }, select: { context: true, number: true } })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({
                where: { id: dest.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${dest.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(dest.id)},1`
        case 'holiday':
            return `${HOL_CONTEXT},${holEntry(dest.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(dest.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(dest.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(dest.id)},1`
        case 'variable-set':
            return `${VAR_CONTEXT},${varEntry(dest.id)},1`
        case 'variable-condition':
            return `${VARCOND_CONTEXT},${varCondEntry(dest.id)},1`
    }
}

// value pode conter interpolação nativa do Asterisk (${OUTRAVAR}) — resolvida em tempo de chamada
// pelo próprio Set(), sem precisar de AGI (diferente de RequestTemplate.variableMappings)
export function buildDialplan(id: string, name: string, assignments: Assignment[], target: string | null): DialplanRow[] {
    const context = VAR_CONTEXT
    const exten = varEntry(id)
    const entries: DialplanRow[] = [{ context, exten, priority: 1, app: 'NoOp', appdata: `VariableSet: ${name}` }]

    let priority = 2
    for (const a of assignments) {
        entries.push({ context, exten, priority, app: 'Set', appdata: `${a.variable}=${a.value}` })
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
            const sets = await prisma.variableSet.findMany({ where: { companyId } })
            const entries: DialplanRow[] = []
            for (const s of sets) {
                const target = await resolveTarget(s.destination as RouteDestination)
                entries.push(...buildDialplan(s.id, s.name, s.assignments as Assignment[], target))
            }
            await writeContextFile(VAR_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
