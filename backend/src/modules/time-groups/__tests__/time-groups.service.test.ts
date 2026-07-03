import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/time-groups.cache', () => ({
    TimeGroupsCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        invalidateByCompany: mock(),
        getTimeGroup: mock(() => null), setTimeGroup: mock(),
        invalidateTimeGroup: mock(),
        invalidateAll: mock(), invalidateNamespace: mock(),
    },
}))
mock.module('../../time-conditions/time-conditions.service', () => ({
    resyncTimeConditionDialplan: mock(() => Promise.resolve()),
}))
mock.module('../../time-conditions/cache/time-conditions.cache', () => ({
    TimeConditionsCache: { invalidateTimeCondition: mock(() => Promise.resolve()), invalidateByCompany: mock(() => Promise.resolve()) },
}))

import * as TimeGroupsService from '../time-groups.service'

const COMPANY = { id: 'c1', name: 'ACME' }
const RANGE = { id: 'r1', startTime: '08:00', endTime: '18:00', weekdays: ['mon', 'fri'], monthdays: '*', months: '*', createdAt: new Date() }
const GROUP = { id: 'g1', name: 'comercial', companyId: 'c1', ranges: [RANGE], createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── getTimeGroupsByCompany ───────────────────────────────────────────────────
describe('TimeGroupsService.getTimeGroupsByCompany', () => {
    it('returns list of groups', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeGroup.findMany.mockResolvedValue([GROUP])
        const groups = await TimeGroupsService.getTimeGroupsByCompany('c1') as any[]
        expect(groups[0].id).toBe('g1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TimeGroupsService.getTimeGroupsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getTimeGroupById ─────────────────────────────────────────────────────────
describe('TimeGroupsService.getTimeGroupById', () => {
    it('returns group by id', async () => {
        db.timeGroup.findUnique.mockResolvedValue(GROUP)
        const group = await TimeGroupsService.getTimeGroupById('g1') as any
        expect(group.id).toBe('g1')
    })

    it('throws 404 with non-existent id', async () => {
        db.timeGroup.findUnique.mockResolvedValue(null)
        await expect(TimeGroupsService.getTimeGroupById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createTimeGroup ──────────────────────────────────────────────────────────
describe('TimeGroupsService.createTimeGroup', () => {
    const INPUT = { name: 'comercial', companyId: 'c1', ranges: [{ startTime: '08:00', endTime: '18:00', weekdays: ['mon', 'fri'] as any, monthdays: '*', months: '*' }] }

    it('creates time group', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeGroup.findUnique.mockResolvedValue(null)
        db.timeGroup.create.mockResolvedValue(GROUP)
        const group = await TimeGroupsService.createTimeGroup(INPUT) as any
        expect(group.id).toBe('g1')
    })

    it('throws 409 on duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeGroup.findUnique.mockResolvedValue(GROUP)
        await expect(TimeGroupsService.createTimeGroup(INPUT))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TimeGroupsService.createTimeGroup({ ...INPUT, companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateTimeGroup ──────────────────────────────────────────────────────────
describe('TimeGroupsService.updateTimeGroup', () => {
    it('updates name', async () => {
        db.timeGroup.findUnique.mockResolvedValueOnce(GROUP).mockResolvedValueOnce(null)
        db.timeGroup.update.mockResolvedValue({ ...GROUP, name: 'noturno' })
        const group = await TimeGroupsService.updateTimeGroup('g1', { name: 'noturno' }) as any
        expect(group.name).toBe('noturno')
    })

    it('throws 404 with non-existent id', async () => {
        db.timeGroup.findUnique.mockResolvedValue(null)
        await expect(TimeGroupsService.updateTimeGroup('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 on duplicate name', async () => {
        db.timeGroup.findUnique.mockResolvedValueOnce(GROUP).mockResolvedValueOnce({ ...GROUP, id: 'g2', name: 'noturno' })
        await expect(TimeGroupsService.updateTimeGroup('g1', { name: 'noturno' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })
})

// ─── deleteTimeGroup ──────────────────────────────────────────────────────────
describe('TimeGroupsService.deleteTimeGroup', () => {
    it('deletes group', async () => {
        db.timeGroup.findUnique.mockResolvedValue(GROUP)
        db.timeGroup.delete.mockResolvedValue(GROUP)
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        await TimeGroupsService.deleteTimeGroup('g1')
        expect(db.timeGroup.delete).toHaveBeenCalledWith({ where: { id: 'g1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.timeGroup.findUnique.mockResolvedValue(null)
        await expect(TimeGroupsService.deleteTimeGroup('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
