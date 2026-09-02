import { prisma } from '../../lib/prisma'
import type { RouteDest } from '../../modules/time-conditions/schemas/time-condition.schema'
import { TC_CONTEXT, tcEntry } from '../dialplan/dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from '../dialplan/dialplan-file.repository'
import { resolveRouteDestinationToDialplan } from '../dialplan/route-destination-resolver'
import { FlowEdgeRepository } from '../flows/flow-edge.repository'
import { nodeExitCheck } from '../flows/flow-node-runtime'

export { TC_CONTEXT, tcEntry }

const tcMatched = (tcId: string) => `tc-${tcId}-matched`

type TimeRange = {
    startTime: string
    endTime:   string
    weekdays:  string[]
    monthdays: string
    months:    string
}

async function resolveRoute(route: RouteDest): Promise<string | null> {
    const target = await resolveRouteDestinationToDialplan(route)
    return target ? `${target.context},${target.exten},${target.priority}` : null
}

function buildDialplan(
    tcId: string,
    name: string,
    ranges: TimeRange[],
    trueAsterisk: string | null,
    falseAsterisk: string | null,
    timezone: string,
): DialplanRow[] {
    const context = TC_CONTEXT
    const entry = tcEntry(tcId)
    const matched = tcMatched(tcId)
    const entries: DialplanRow[] = []

    entries.push({ context, exten: entry, priority: 1, app: 'NoOp', appdata: `TimeCondition: ${name}` })

    let priority = 2
    for (const range of ranges) {
        const weekSpec = range.weekdays.length > 0 ? range.weekdays.join('&') : '*'
        entries.push({
            context, exten: entry, priority,
            app: 'GotoIfTime',
            appdata: `${range.startTime}-${range.endTime},${weekSpec},${range.monthdays},${range.months}@${timezone}?${matched},1`,
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

export const TimeConditionRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco (TimeCondition + ranges agregados via TimeGroups vinculados) - chamado depois
    // de qualquer create/update/delete de TimeCondition, ou de mudança num TimeGroup vinculado.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${TC_CONTEXT}:${asteriskId}`, async () => {
            const [conditions, edges, company] = await Promise.all([
                prisma.timeCondition.findMany({
                    where: { companyId },
                    include: { timeGroups: { include: { timeGroup: { include: { ranges: true } } } } },
                }),
                FlowEdgeRepository.getBySource(companyId, 'timecondition'),
                prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { timezone: true } }),
            ])
            const entries: DialplanRow[] = []
            for (const tc of conditions) {
                const ranges = tc.timeGroups.flatMap((g) => g.timeGroup.ranges)
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(edges.get(tc.id)?.true ?? null),
                    resolveRoute(edges.get(tc.id)?.false ?? null),
                ])
                entries.push(...buildDialplan(tc.id, tc.name, ranges, trueAsterisk, falseAsterisk, company.timezone))
            }
            await writeContextFile(TC_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
