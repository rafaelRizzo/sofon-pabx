import { prisma } from '../lib/prisma'
import type { RouteDest } from '../modules/time-conditions/schemas/time-condition.schema'
import { queueAppExten } from './queue.repository'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type TimeRange = {
    startTime: string
    endTime:   string
    weekdays:  string[]
    monthdays: string
    months:    string
}

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
            return `tc-${route.id},s,1`
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
) {
    const context = `tc-${tcId}`
    const entries: { context: string; exten: string; priority: number; app: string; appdata: string | null }[] = []

    entries.push({ context, exten: 's', priority: 1, app: 'NoOp', appdata: `TimeCondition: ${name}` })

    let priority = 2
    for (const range of ranges) {
        const weekSpec = range.weekdays.length > 0 ? range.weekdays.join('&') : '*'
        entries.push({
            context, exten: 's', priority,
            app: 'GotoIfTime',
            appdata: `${range.startTime}-${range.endTime},${weekSpec},${range.monthdays},${range.months}?matched,1`,
        })
        priority++
    }

    entries.push({
        context, exten: 's', priority,
        app: falseAsterisk ? 'Goto' : 'Hangup',
        appdata: falseAsterisk,
    })

    entries.push({
        context, exten: 'matched', priority: 1,
        app: trueAsterisk ? 'Goto' : 'Hangup',
        appdata: trueAsterisk,
    })

    return entries
}

export const TimeConditionRepository = {
    async create(tx: Tx, tcId: string, name: string, ranges: TimeRange[], trueRoute: RouteDest, falseRoute: RouteDest) {
        const [trueAsterisk, falseAsterisk] = await Promise.all([
            resolveRoute(tx, trueRoute),
            resolveRoute(tx, falseRoute),
        ])
        const data = buildDialplan(tcId, name, ranges, trueAsterisk, falseAsterisk)
        if (data.length > 0) await tx.extensions.createMany({ data })
    },

    async update(tx: Tx, tcId: string, name: string, ranges: TimeRange[], trueRoute: RouteDest, falseRoute: RouteDest) {
        await tx.extensions.deleteMany({ where: { context: `tc-${tcId}` } })
        const [trueAsterisk, falseAsterisk] = await Promise.all([
            resolveRoute(tx, trueRoute),
            resolveRoute(tx, falseRoute),
        ])
        const data = buildDialplan(tcId, name, ranges, trueAsterisk, falseAsterisk)
        if (data.length > 0) await tx.extensions.createMany({ data })
    },

    async delete(tx: Tx, tcId: string) {
        await tx.extensions.deleteMany({ where: { context: `tc-${tcId}` } })
    },

    async deleteManyByIds(tx: Tx, tcIds: string[]) {
        if (tcIds.length === 0) return
        await tx.extensions.deleteMany({ where: { context: { in: tcIds.map((id) => `tc-${id}`) } } })
    },
}
