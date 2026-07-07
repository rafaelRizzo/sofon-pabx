import { prisma } from '../lib/prisma'
import type { RouteDest } from '../modules/holiday-groups/schemas/holiday-group.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'
import { resolveAsteriskId, withDialplanLock, writeContextFile, reloadDialplan, type DialplanRow } from './dialplan-file.repository'

export { HOL_CONTEXT, holEntry }

const holMatched = (id: string) => `hol-${id}-matched`

const MONTH_CODES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type HolidayDate = { month: number; day: number }

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

export const HolidayGroupRepository = {
    // Reconstrói o arquivo de dialplan da empresa inteira pra esse contexto, a partir do estado
    // atual em banco — chamado depois de qualquer create/update/delete de HolidayGroup (fora da tx,
    // já que é I/O de arquivo + spawn de subprocesso). Sempre consistente com o banco, mesmo se uma
    // regeneração concorrente for perdida (a próxima chamada corrige).
    async regenerate(companyId: string) {
        const asteriskId = await resolveAsteriskId(companyId)
        return withDialplanLock(`${HOL_CONTEXT}:${asteriskId}`, async () => {
            const groups = await prisma.holidayGroup.findMany({ where: { companyId }, include: { dates: true } })
            const entries: DialplanRow[] = []
            for (const g of groups) {
                const [trueAsterisk, falseAsterisk] = await Promise.all([
                    resolveRoute(g.trueRoute as RouteDest),
                    resolveRoute(g.falseRoute as RouteDest),
                ])
                entries.push(...buildDialplan(g.id, g.name, g.dates, trueAsterisk, falseAsterisk))
            }
            await writeContextFile(HOL_CONTEXT, asteriskId, entries)
            reloadDialplan()
        })
    },
}
