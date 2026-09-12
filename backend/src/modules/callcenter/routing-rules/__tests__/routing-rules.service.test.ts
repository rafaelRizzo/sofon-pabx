import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../../../trunks/cache/trunks.cache', () => ({
    TrunksCache: { getTrunk: mock(() => null), setTrunk: mock(), invalidateAllTrunks: mock(), invalidateByCompany: mock() },
}))
mock.module('../cache/routing-rule.cache', () => ({
    RoutingRulesCache: {
        getByCompany: mock(() => null), setByCompany: mock(), invalidateByCompany: mock(),
        getRule: mock(() => null), setRule: mock(), invalidateRule: mock(),
    },
}))

import * as RoutingRulesService from '../routing-rules.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const RULE = {
    id: 'r1', name: 'vip-empresa-x', companyId: 'c1', priority: 10,
    conditions: { callerIdPattern: '^1140000000' }, active: true,
    createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

describe('RoutingRulesService.getRoutingRulesByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(RoutingRulesService.getRoutingRulesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns rules list', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([RULE])
        const rules = await RoutingRulesService.getRoutingRulesByCompany('c1') as any[]
        expect(rules[0].id).toBe('r1')
    })
})

describe('RoutingRulesService.getRoutingRuleById', () => {
    it('returns rule', async () => {
        db.routingRule.findUnique.mockResolvedValue(RULE)
        const rule = await RoutingRulesService.getRoutingRuleById('r1') as any
        expect(rule.id).toBe('r1')
    })

    it('throws 404 with non-existent id', async () => {
        db.routingRule.findUnique.mockResolvedValue(null)
        await expect(RoutingRulesService.getRoutingRuleById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('RoutingRulesService.createRoutingRule', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(RoutingRulesService.createRoutingRule({
            name: 'test', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', priority: 0, conditions: {}, active: true,
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findUnique.mockResolvedValue(RULE)
        await expect(RoutingRulesService.createRoutingRule({
            name: 'vip-empresa-x', companyId: 'c1', priority: 0, conditions: {}, active: true,
        }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates routing rule', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findUnique.mockResolvedValue(null)
        db.routingRule.create.mockResolvedValue(RULE)
        const rule = await RoutingRulesService.createRoutingRule({
            name: 'vip-empresa-x', companyId: 'c1', priority: 10, conditions: { callerIdPattern: '^1140000000' }, active: true,
        }) as any
        expect(rule.id).toBe('r1')
    })

    it('throws 400 when trunk belongs to a different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findUnique.mockResolvedValue(null)
        db.trunk.findUnique.mockResolvedValue({ id: 't1', companyId: 'other-company' })
        await expect(RoutingRulesService.createRoutingRule({
            name: 'por-tronco', companyId: 'c1', priority: 0, conditions: { trunkId: 't1' }, active: true,
        }))
            .rejects.toMatchObject({ statusCode: 400 })
    })

    it('creates routing rule scoped to a trunk of the same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findUnique.mockResolvedValue(null)
        db.trunk.findUnique.mockResolvedValue({ id: 't1', companyId: 'c1' })
        db.routingRule.create.mockResolvedValue({ ...RULE, conditions: { trunkId: 't1' } })
        const rule = await RoutingRulesService.createRoutingRule({
            name: 'por-tronco', companyId: 'c1', priority: 0, conditions: { trunkId: 't1' }, active: true,
        }) as any
        expect(rule.conditions.trunkId).toBe('t1')
    })
})

describe('RoutingRulesService.updateRoutingRule', () => {
    it('throws 404 when rule not found', async () => {
        db.routingRule.findUnique.mockResolvedValue(null)
        await expect(RoutingRulesService.updateRoutingRule('clxxxxxxxxxxxxxxxxxxxxxxxxx', { priority: 5 }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when new name already in use', async () => {
        db.routingRule.findUnique.mockResolvedValueOnce(RULE).mockResolvedValueOnce({ ...RULE, id: 'r2' })
        await expect(RoutingRulesService.updateRoutingRule('r1', { name: 'outra-regra' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('updates rule', async () => {
        db.routingRule.findUnique.mockResolvedValueOnce(RULE)
        db.routingRule.update.mockResolvedValue({ ...RULE, priority: 20 })
        const rule = await RoutingRulesService.updateRoutingRule('r1', { priority: 20 }) as any
        expect(rule.priority).toBe(20)
    })
})

describe('RoutingRulesService.resolveActiveRule', () => {
    const BASE_CTX = { callerId: '1140000000', at: new Date('2026-01-05T15:00:00.000Z'), timezone: 'America/Sao_Paulo' } // 2026-01-05 = Monday

    it('returns null when no rule matches', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([{ ...RULE, active: true, conditions: { callerIdPattern: '^999' } }])
        const rule = await RoutingRulesService.resolveActiveRule('c1', BASE_CTX)
        expect(rule).toBeNull()
    })

    it('matches by callerIdPattern', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([{ ...RULE, active: true, conditions: { callerIdPattern: '^114' } }])
        const rule = await RoutingRulesService.resolveActiveRule('c1', BASE_CTX) as any
        expect(rule.id).toBe('r1')
    })

    it('matches by weekday and skips inactive rules', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([
            { ...RULE, id: 'r-inactive', active: false, priority: 999, conditions: { weekdays: ['mon'] } },
            { ...RULE, id: 'r-active', active: true, priority: 5, conditions: { weekdays: ['mon'], startTime: '08:00', endTime: '18:00' } },
        ])
        const rule = await RoutingRulesService.resolveActiveRule('c1', BASE_CTX) as any
        expect(rule.id).toBe('r-active')
    })

    it('rejects when outside the weekday/time window', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([{ ...RULE, active: true, conditions: { weekdays: ['sun'] } }])
        const rule = await RoutingRulesService.resolveActiveRule('c1', BASE_CTX)
        expect(rule).toBeNull()
    })

    it('matches by trunkId', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([{ ...RULE, active: true, conditions: { trunkId: 't1' } }])
        const rule = await RoutingRulesService.resolveActiveRule('c1', { ...BASE_CTX, trunkId: 't1' }) as any
        expect(rule.id).toBe('r1')
    })

    it('rejects when trunkId does not match', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([{ ...RULE, active: true, conditions: { trunkId: 't1' } }])
        const rule = await RoutingRulesService.resolveActiveRule('c1', { ...BASE_CTX, trunkId: 't2' })
        expect(rule).toBeNull()
    })

    it('picks the highest priority among matching rules', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.routingRule.findMany.mockResolvedValue([
            { ...RULE, id: 'r-low', active: true, priority: 1, conditions: {} },
            { ...RULE, id: 'r-high', active: true, priority: 50, conditions: {} },
        ])
        const rule = await RoutingRulesService.resolveActiveRule('c1', BASE_CTX) as any
        expect(rule.id).toBe('r-high')
    })
})

describe('RoutingRulesService.deleteRoutingRule', () => {
    it('throws 404 when rule not found', async () => {
        db.routingRule.findUnique.mockResolvedValue(null)
        await expect(RoutingRulesService.deleteRoutingRule('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('deletes rule', async () => {
        db.routingRule.findUnique.mockResolvedValue(RULE)
        db.routingRule.delete.mockResolvedValue(RULE)
        await RoutingRulesService.deleteRoutingRule('r1')
        expect(db.routingRule.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
    })
})
