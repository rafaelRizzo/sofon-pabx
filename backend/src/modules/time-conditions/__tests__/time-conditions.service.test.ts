import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/time-conditions.cache', () => ({
    TimeConditionsCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        invalidateByCompany: mock(),
        getTimeCondition: mock(() => null), setTimeCondition: mock(),
        invalidateTimeCondition: mock(),
        invalidateNamespace: mock(),
    },
}))
mock.module('../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { getExtension: mock(() => null), setExtension: mock() },
}))
mock.module('../../../asterisk/timecondition.repository', () => ({
    TimeConditionRepository: {
        create: mock(() => Promise.resolve()),
        update: mock(() => Promise.resolve()),
        delete: mock(() => Promise.resolve()),
        deleteManyByIds: mock(() => Promise.resolve()),
    },
}))

import * as TimeConditionsService from '../time-conditions.service'

const COMPANY = { id: 'c1', name: 'ACME' }
const EXT = { id: 'e1', companyId: 'c1', context: 'ramais', number: '1001' }
const QUEUE = { id: 'q1', companyId: 'c1', number: '5000' }
const TC = {
    id: 'tc1', name: 'horario-comercial', companyId: 'c1',
    trueRoute: { type: 'extension', id: 'e1' },
    falseRoute: { type: 'hangup' },
    timeGroups: [], createdAt: new Date(), updatedAt: new Date(),
}
const GROUP = { id: 'g1', name: 'comercial', companyId: 'c1' }

beforeEach(() => clearPrismaMock(db))

// ─── getTimeConditionsByCompany ───────────────────────────────────────────────
describe('TimeConditionsService.getTimeConditionsByCompany', () => {
    it('returns list of conditions', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findMany.mockResolvedValue([TC])
        const conditions = await TimeConditionsService.getTimeConditionsByCompany('c1') as any[]
        expect(conditions[0].id).toBe('tc1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.getTimeConditionsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getTimeConditionById ─────────────────────────────────────────────────────
describe('TimeConditionsService.getTimeConditionById', () => {
    it('returns condition by id', async () => {
        db.timeCondition.findUnique.mockResolvedValue(TC)
        const tc = await TimeConditionsService.getTimeConditionById('tc1') as any
        expect(tc.id).toBe('tc1')
    })

    it('throws 404 with non-existent id', async () => {
        db.timeCondition.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.getTimeConditionById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createTimeCondition ──────────────────────────────────────────────────────
describe('TimeConditionsService.createTimeCondition', () => {
    it('creates condition with extension route', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.timeCondition.create.mockResolvedValue(TC)
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        const tc = await TimeConditionsService.createTimeCondition({
            name: 'horario-comercial', companyId: 'c1',
            trueRoute: { type: 'extension', id: 'e1' },
            falseRoute: { type: 'hangup' },
            groupIds: [],
        }) as any
        expect(tc.id).toBe('tc1')
    })

    it('creates condition with queue route', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.timeCondition.create.mockResolvedValue(TC)
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        const tc = await TimeConditionsService.createTimeCondition({
            name: 'horario-comercial', companyId: 'c1',
            trueRoute: { type: 'queue', id: 'q1' },
            groupIds: [],
        }) as any
        expect(tc.id).toBe('tc1')
    })

    it('throws 404 when trueRoute extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'c1',
            trueRoute: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
            groupIds: [],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when extension belongs to different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue({ ...EXT, companyId: 'other' })
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'c1',
            trueRoute: { type: 'extension', id: 'e1' },
            groupIds: [],
        })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 400 when queue has no number', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.queue.findUnique.mockResolvedValue({ ...QUEUE, number: null })
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'c1',
            trueRoute: { type: 'queue', id: 'q1' },
            groupIds: [],
        })).rejects.toMatchObject({ statusCode: 400 })
    })

    it('creates with announcement falseRoute', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.announcement.findUnique.mockResolvedValue({ companyId: 'c1', audioId: 'audio1' })
        db.timeCondition.create.mockResolvedValue({ ...TC, falseRoute: { type: 'announcement', id: 'ann1' } })
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        const tc = await TimeConditionsService.createTimeCondition({
            name: 'horario-comercial', companyId: 'c1',
            falseRoute: { type: 'announcement', id: 'ann1' },
            groupIds: [],
        }) as any
        expect(tc.id).toBe('tc1')
    })

    it('throws 400 when announcement has no audio uploaded yet', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.announcement.findUnique.mockResolvedValue({ companyId: 'c1', audioId: null })
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'c1',
            falseRoute: { type: 'announcement', id: 'ann1' },
            groupIds: [],
        })).rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 409 on duplicate name', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(TC)
        await expect(TimeConditionsService.createTimeCondition({
            name: 'horario-comercial', companyId: 'c1', groupIds: [],
        })).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', groupIds: [],
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when groupId not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.timeCondition.findUnique.mockResolvedValue(null)
        db.timeGroup.findMany.mockResolvedValue([])
        await expect(TimeConditionsService.createTimeCondition({
            name: 'x', companyId: 'c1', groupIds: ['clxxxxxxxxxxxxxxxxxxxxxxxxx'],
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateTimeCondition ──────────────────────────────────────────────────────
describe('TimeConditionsService.updateTimeCondition', () => {
    it('updates name', async () => {
        db.timeCondition.findUnique.mockResolvedValueOnce(TC).mockResolvedValueOnce(null)
        db.timeCondition.update.mockResolvedValue({ ...TC, name: 'noturno' })
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        const tc = await TimeConditionsService.updateTimeCondition('tc1', { name: 'noturno' }) as any
        expect(tc.name).toBe('noturno')
    })

    it('updates trueRoute to timecondition', async () => {
        const OTHER_TC = { id: 'tc2', companyId: 'c1' }
        db.timeCondition.findUnique.mockResolvedValueOnce(TC).mockResolvedValueOnce(OTHER_TC)
        db.timeCondition.update.mockResolvedValue({ ...TC, trueRoute: { type: 'timecondition', id: 'tc2' } })
        db.timeConditionTimeGroup.findMany.mockResolvedValue([])
        await TimeConditionsService.updateTimeCondition('tc1', { trueRoute: { type: 'timecondition', id: 'tc2' } })
        expect(db.timeCondition.update).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.timeCondition.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.updateTimeCondition('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteTimeCondition ──────────────────────────────────────────────────────
describe('TimeConditionsService.deleteTimeCondition', () => {
    it('deletes time condition', async () => {
        db.timeCondition.findUnique.mockResolvedValue(TC)
        db.timeCondition.delete.mockResolvedValue(TC)
        await TimeConditionsService.deleteTimeCondition('tc1')
        expect(db.timeCondition.delete).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.timeCondition.findUnique.mockResolvedValue(null)
        await expect(TimeConditionsService.deleteTimeCondition('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
