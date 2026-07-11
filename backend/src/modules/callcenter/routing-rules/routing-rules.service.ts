import { prisma } from '../../../lib/prisma'
import { getCompanyById } from '../../companies/companies.service'
import { getTrunkById } from '../../trunks/trunks.service'
import { RoutingRulesCache } from './cache/routing-rule.cache'
import type { CreateRoutingRuleInput, UpdateRoutingRuleInput } from './schemas/routing-rule.schema'
import { AppError } from '../../../utils/errors/app.error'

const assertTrunkBelongsToCompany = async (trunkId: string | undefined, companyId: string) => {
    if (!trunkId) return
    const trunk = await getTrunkById(trunkId)
    if (trunk.companyId !== companyId) throw new AppError('Trunk does not belong to this company', 400)
}

const routingRuleSelect = {
    id: true,
    name: true,
    companyId: true,
    priority: true,
    conditions: true,
    active: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getRoutingRulesByCompany = async (companyId: string) => {
    const cached = await RoutingRulesCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const rules = await prisma.routingRule.findMany({
        where: { companyId },
        select: routingRuleSelect,
        orderBy: { priority: 'desc' },
    })
    await RoutingRulesCache.setByCompany(companyId, rules)
    return rules
}

export const getRoutingRuleById = async (id: string) => {
    const cached = await RoutingRulesCache.getRule(id)
    if (cached) return cached

    const rule = await prisma.routingRule.findUnique({ where: { id }, select: routingRuleSelect })
    if (!rule) throw new AppError('Routing rule not found', 404)

    await RoutingRulesCache.setRule(id, rule)
    return rule
}

export const createRoutingRule = async (data: CreateRoutingRuleInput) => {
    await getCompanyById(data.companyId)
    await assertTrunkBelongsToCompany(data.conditions?.trunkId, data.companyId)

    const existing = await prisma.routingRule.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Routing rule already exists for this company', 409)

    const rule = await prisma.routingRule.create({ data, select: routingRuleSelect })
    await RoutingRulesCache.invalidateByCompany(data.companyId)
    return rule
}

export const updateRoutingRule = async (id: string, data: UpdateRoutingRuleInput) => {
    const existing = await prisma.routingRule.findUnique({ where: { id } })
    if (!existing) throw new AppError('Routing rule not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const duplicate = await prisma.routingRule.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (duplicate) throw new AppError('Routing rule name already in use for this company', 409)
    }

    if (data.conditions?.trunkId !== undefined)
        await assertTrunkBelongsToCompany(data.conditions.trunkId, existing.companyId)

    const rule = await prisma.routingRule.update({ where: { id }, data, select: routingRuleSelect })
    await RoutingRulesCache.invalidateRule(id)
    await RoutingRulesCache.invalidateByCompany(existing.companyId)
    return rule
}

type ResolveContext = { callerId: string; at: Date; timezone: string; trunkId?: string | null }

const WEEKDAY_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// weekday/HH:MM via Intl (não depende do TZ do processo Node/Bun) — avalia no fuso da empresa,
// mesmo vocabulário de Time Groups (weekdays mon-sun, startTime/endTime HH:MM)
const partsInTz = (at: Date, timezone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const weekday = get('weekday').toLowerCase().slice(0, 3) as (typeof WEEKDAY_TOKENS)[number]
    const hhmm = `${get('hour')}:${get('minute')}`
    return { weekday, hhmm }
}

const matchesConditions = (conditions: Record<string, any>, ctx: ResolveContext): boolean => {
    if (conditions.trunkId && conditions.trunkId !== ctx.trunkId) return false

    if (conditions.callerIdPattern) {
        let re: RegExp
        try {
            re = new RegExp(conditions.callerIdPattern)
        } catch {
            return false
        }
        if (!re.test(ctx.callerId)) return false
    }

    if (conditions.weekdays?.length || (conditions.startTime && conditions.endTime)) {
        const { weekday, hhmm } = partsInTz(ctx.at, ctx.timezone)
        if (conditions.weekdays?.length && !conditions.weekdays.includes(weekday)) return false
        if (conditions.startTime && conditions.endTime && !(hhmm >= conditions.startTime && hhmm <= conditions.endTime)) return false
    }

    return true
}

// Maior priority entre as regras ativas cujas conditions batem — usado pelo AGI de pré-roteamento
// (handleQueueRoute) pra setar QUEUE_PRIO antes do Queue() nativo assumir.
export const resolveActiveRule = async (companyId: string, ctx: ResolveContext) => {
    const rules = await getRoutingRulesByCompany(companyId)
    const matching = (rules as any[]).filter((r) => r.active && matchesConditions(r.conditions, ctx))
    if (matching.length === 0) return null
    return matching.reduce((best, r) => (r.priority > best.priority ? r : best))
}

export const deleteRoutingRule = async (id: string) => {
    const existing = await prisma.routingRule.findUnique({ where: { id } })
    if (!existing) throw new AppError('Routing rule not found', 404)

    await prisma.routingRule.delete({ where: { id } })
    await RoutingRulesCache.invalidateRule(id)
    await RoutingRulesCache.invalidateByCompany(existing.companyId)
}
