import { prisma } from '../lib/prisma'
import type { RouteDest } from '../modules/time-conditions/schemas/time-condition.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

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
    if (!route) return null

    switch (route.type) {
        case 'extension': {
            const ext = await prisma.extension.findUnique({
                where: { id: route.id },
                select: { context: true, number: true },
            })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await prisma.queue.findUnique({
                where: { id: route.id },
                select: { number: true, company: { select: { asteriskId: true } } },
            })
            return q?.number ? `queues-app,${queueAppExten(q.company.asteriskId, q.number)},1` : null
        }
        case 'voicemail':
            return `vm,${route.id},1`
        case 'timecondition':
            return `${TC_CONTEXT},${tcEntry(route.id)},1`
        case 'holiday':
            return `${HOL_CONTEXT},${holEntry(route.id)},1`
        case 'announcement':
            return `${ANNOUNCEMENT_CONTEXT},${announcementExten(route.id)},1`
        case 'ivr':
            return `${IVR_CONTEXT},${ivrExten(route.id)},1`
        case 'request':
            return `${REQUEST_TEMPLATE_CONTEXT},${requestTemplateExten(route.id)},1`
        case 'hangup':
            return null
    }
}

function buildDialplan(
    tcId: string,
    name: string,
    ranges: TimeRange[],
    trueAsterisk: string | null,
    falseAsterisk: string | null,
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
            appdata: `${range.startTime}-${range.endTime},${weekSpec},${range.monthdays},${range.months}?${matched},1`,
        })
        priority++
    }

    entries.push({
        context, exten: entry, priority,
        app: falseAsterisk ? 'Goto' : 'Hangup',
        appdata: falseAsterisk,
    })

    entries.push({
        context, exten: matched, priority: 1,
        app: trueAsterisk ? 'Goto' : 'Hangup',
        appdata: trueAsterisk,
    })

    return entries
}

export const TimeConditionRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco (TimeCondition + ranges agregados via TimeGroups vinculados) — chamado depois
    // de qualquer create/update/delete de TimeCondition, ou de mudança num TimeGroup vinculado.
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${TC_CONTEXT}:${asteriskId}`, async () => {
            const conditions = await prisma.timeCondition.findMany({
                where: { companyId },
                include: { timeGroups: { include: { timeGroup: { include: { ranges: true } } } } },
            })
            const entries: DialplanRow[] = []
            for (const tc of conditions) {
                const ranges = tc.timeGroups.flatMap((g) => g.timeGroup.ranges)
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(tc.trueRoute as RouteDest),
                    resolveRoute(tc.falseRoute as RouteDest),
                ])
                entries.push(...buildDialplan(tc.id, tc.name, ranges, trueAsterisk, falseAsterisk))
            }
            await writeContextFile(TC_CONTEXT, asteriskId, entries)
            await reloadDialplan()
        })
    },
}
