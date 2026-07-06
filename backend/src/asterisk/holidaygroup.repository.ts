import { prisma } from '../lib/prisma'
import type { RouteDest } from '../modules/holiday-groups/schemas/holiday-group.schema'
import { queueAppExten } from './queue.repository'
import {
    TC_CONTEXT, tcEntry, ANNOUNCEMENT_CONTEXT, announcementExten, IVR_CONTEXT, ivrExten,
    REQUEST_TEMPLATE_CONTEXT, requestTemplateExten, HOL_CONTEXT, holEntry,
} from './dialplan-names'

export { HOL_CONTEXT, holEntry }

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const holMatched = (id: string) => `hol-${id}-matched`

const MONTH_CODES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type HolidayDate = { month: number; day: number }

async function resolveRoute(tx: Tx, route: RouteDest): Promise<string | null> {
    if (!route) return null

    switch (route.type) {
        case 'extension': {
            const ext = await tx.extension.findUnique({
                where: { id: route.id },
                select: { context: true, number: true },
            })
            return ext ? `${ext.context},${ext.number},1` : null
        }
        case 'queue': {
            const q = await tx.queue.findUnique({
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
) {
    const context = HOL_CONTEXT
    const entry = holEntry(id)
    const matched = holMatched(id)
    const entries: { context: string; exten: string; priority: number; app: string; appdata: string | null }[] = []

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
    async create(tx: Tx, id: string, name: string, dates: HolidayDate[], trueRoute: RouteDest, falseRoute: RouteDest) {
        const [trueAsterisk, falseAsterisk] = await Promise.all([
            resolveRoute(tx, trueRoute),
            resolveRoute(tx, falseRoute),
        ])
        const data = buildDialplan(id, name, dates, trueAsterisk, falseAsterisk)
        if (data.length > 0) await tx.extensions.createMany({ data })
    },

    async update(tx: Tx, id: string, name: string, dates: HolidayDate[], trueRoute: RouteDest, falseRoute: RouteDest) {
        await tx.extensions.deleteMany({ where: { context: HOL_CONTEXT, exten: { in: [holEntry(id), holMatched(id)] } } })
        const [trueAsterisk, falseAsterisk] = await Promise.all([
            resolveRoute(tx, trueRoute),
            resolveRoute(tx, falseRoute),
        ])
        const data = buildDialplan(id, name, dates, trueAsterisk, falseAsterisk)
        if (data.length > 0) await tx.extensions.createMany({ data })
    },

    async delete(tx: Tx, id: string) {
        await tx.extensions.deleteMany({ where: { context: HOL_CONTEXT, exten: { in: [holEntry(id), holMatched(id)] } } })
    },

    async deleteManyByIds(tx: Tx, ids: string[]) {
        if (ids.length === 0) return
        const extens = ids.flatMap((id) => [holEntry(id), holMatched(id)])
        await tx.extensions.deleteMany({ where: { context: HOL_CONTEXT, exten: { in: extens } } })
    },
}
