import { prisma } from '../../lib/prisma'
import type { RouteDest } from '../../modules/holiday-groups/schemas/holiday-group.schema'
import { HOL_CONTEXT, holEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'
import { nodeExitCheck } from '../flows/flow-node-runtime'

export { HOL_CONTEXT, holEntry }

const holMatched = (id: string) => `hol-${id}-matched`

const MONTH_CODES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type HolidayDate = { month: number; day: number }

async function resolveRoute(route: RouteDest): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(route)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

function buildDialplan(
    id: string,
    name: string,
    dates: HolidayDate[],
    trueAsterisk: string | null,
    falseAsterisk: string | null,
): DialplanRow[] {
    const context = HOL_CONTEXT
    const entry = holEntry(id)
    const matched = holMatched(id)
    const entries: DialplanRow[] = []

    entries.push({ context, exten: entry, priority: 1, app: 'NoOp', appdata: `HolidayGroup: ${name}` })

    let priority = 2
    for (const date of dates) {
        entries.push({
            context, exten: entry, priority,
            app: 'GotoIfTime',
            appdata: `00:00-23:59,*,${date.day},${MONTH_CODES[date.month - 1]}?${matched},1`,
        })
        priority++
    }

    entries.push({
        context, exten: entry, priority,
        app: 'GotoIf',
        appdata: nodeExitCheck(context, entry, priority, 'false').appdata,
    })
    entries.push({
        context, exten: entry, priority: priority + 1,
        app: falseAsterisk ? 'Goto' : 'Hangup',
        appdata: falseAsterisk,
    })

    entries.push({
        context, exten: matched, priority: 1,
        app: 'GotoIf',
        appdata: nodeExitCheck(context, matched, 1, 'true').appdata,
    })
    entries.push({
        context, exten: matched, priority: 2,
        app: trueAsterisk ? 'Goto' : 'Hangup',
        appdata: trueAsterisk,
    })

    return entries
}

export const HolidayGroupRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de HolidayGroup (fora da tx,
    // já que é I/O de arquivo + spawn de subprocesso). Sempre consistente com o banco, mesmo se uma
    // regeneração concorrente for perdida (a próxima chamada corrige).
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${HOL_CONTEXT}:${asteriskId}`, async () => {
            const [groups, edges] = await Promise.all([
                prisma.holidayGroup.findMany({ where: { companyId }, include: { dates: true } }),
                FlowEdgeRepository.getBySource(companyId, 'holidaygroup'),
            ])
            const entries: DialplanRow[] = []
            for (const g of groups) {
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(edges.get(g.id)?.true ?? null),
                    resolveRoute(edges.get(g.id)?.false ?? null),
                ])
                entries.push(...buildDialplan(g.id, g.name, g.dates, trueAsterisk, falseAsterisk))
            }
            await writeContextFile(HOL_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
