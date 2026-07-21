import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/holiday-groups.cache', () => ({
    HolidayGroupsCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        invalidateByCompany: mock(),
        getHolidayGroup: mock(() => null), setHolidayGroup: mock(),
        invalidateHolidayGroup: mock(),
        invalidateNamespace: mock(),
    },
}))
mock.module('../../../asterisk/holidaygroup.repository', () => ({
    HolidayGroupRepository: { regenerate: mock(() => Promise.resolve()) },
}))
mock.module('../providers/http.provider', () => ({
    fetchHolidaysFromUrl: mock(() => Promise.resolve(null)),
}))

import * as HolidayGroupsService from '../holiday-groups.service'
import { fetchHolidaysFromUrl } from '../providers/http.provider'

const COMPANY = { id: 'c1', name: 'ACME' }
const EXT = { id: 'e1', companyId: 'c1', context: 'ramais', number: '1001' }
const DATE1 = { id: 'd1', name: 'Natal', month: 12, day: 25 }
const HG = {
    id: 'hg1', name: 'Feriados Nacionais', companyId: 'c1', url: null,
    trueRoute: { type: 'hangup' }, falseRoute: { type: 'extension', id: 'e1' },
    dates: [DATE1], createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => {
    clearPrismaMock(db)
    ;(fetchHolidaysFromUrl as any).mockReset()
    ;(fetchHolidaysFromUrl as any).mockResolvedValue(null)
})

// ─── getHolidayGroupsByCompany ─────────────────────────────────────────────────
describe('HolidayGroupsService.getHolidayGroupsByCompany', () => {
    it('returns list of groups', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.holidayGroup.findMany.mockResolvedValue([HG])
        db.flowEdge.findMany.mockResolvedValue([])
        const groups = await HolidayGroupsService.getHolidayGroupsByCompany('c1') as any[]
        expect(groups[0].id).toBe('hg1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.getHolidayGroupsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getHolidayGroupById ────────────────────────────────────────────────────────
describe('HolidayGroupsService.getHolidayGroupById', () => {
    it('returns group by id', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(HG)
        db.flowEdge.findMany.mockResolvedValue([])
        const hg = await HolidayGroupsService.getHolidayGroupById('hg1') as any
        expect(hg.id).toBe('hg1')
    })

    it('throws 404 with non-existent id', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.getHolidayGroupById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createHolidayGroup ─────────────────────────────────────────────────────────
describe('HolidayGroupsService.createHolidayGroup', () => {
    it('creates group with manual dates', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.holidayGroup.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.holidayGroup.create.mockResolvedValue(HG)
        const hg = await HolidayGroupsService.createHolidayGroup({
            name: 'Feriados Nacionais', companyId: 'c1',
            falseRoute: { type: 'extension', id: 'e1' },
            dates: [{ name: 'Natal', month: 12, day: 25 }],
        }) as any
        expect(hg.id).toBe('hg1')
        expect(fetchHolidaysFromUrl).not.toHaveBeenCalled()
    })

    it('creates group with url — fetches initial dates instead of using local dates', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.holidayGroup.findUnique.mockResolvedValue(null)
        db.holidayGroup.create.mockResolvedValue({ ...HG, url: 'https://example.com/feriados' })
        ;(fetchHolidaysFromUrl as any).mockResolvedValue([{ name: 'Natal', month: 12, day: 25 }])

        const hg = await HolidayGroupsService.createHolidayGroup({
            name: 'Feriados Nacionais', companyId: 'c1',
            url: 'https://example.com/feriados',
        }) as any

        expect(hg.id).toBe('hg1')
        expect(fetchHolidaysFromUrl).toHaveBeenCalledWith('https://example.com/feriados', expect.any(Number))
    })

    it('throws 409 on duplicate name', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.holidayGroup.findUnique.mockResolvedValue(HG)
        await expect(HolidayGroupsService.createHolidayGroup({
            name: 'Feriados Nacionais', companyId: 'c1',
        })).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.createHolidayGroup({
            name: 'x', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when falseRoute extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.holidayGroup.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.createHolidayGroup({
            name: 'x', companyId: 'c1',
            falseRoute: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateHolidayGroup ─────────────────────────────────────────────────────────
describe('HolidayGroupsService.updateHolidayGroup', () => {
    it('updates name', async () => {
        db.holidayGroup.findUnique.mockResolvedValueOnce({ ...HG, dates: [DATE1] }).mockResolvedValueOnce(null)
        db.flowEdge.findMany.mockResolvedValue([])
        db.holidayGroup.update.mockResolvedValue({ ...HG, name: 'Feriados' })
        const hg = await HolidayGroupsService.updateHolidayGroup('hg1', { name: 'Feriados' }) as any
        expect(hg.name).toBe('Feriados')
    })

    it('replaces dates manually when no url configured', async () => {
        db.holidayGroup.findUnique.mockResolvedValue({ ...HG, dates: [DATE1] })
        db.flowEdge.findMany.mockResolvedValue([])
        db.holidayGroup.update.mockResolvedValue(HG)
        await HolidayGroupsService.updateHolidayGroup('hg1', { dates: [{ name: 'Ano Novo', month: 1, day: 1 }] })
        expect(db.holidayDate.deleteMany).toHaveBeenCalledWith({ where: { holidayGroupId: 'hg1' } })
        expect(db.holidayDate.createMany).toHaveBeenCalled()
    })

    it('throws 400 when trying to set dates while url is configured', async () => {
        db.holidayGroup.findUnique.mockResolvedValue({ ...HG, url: 'https://example.com/feriados', dates: [DATE1] })
        await expect(HolidayGroupsService.updateHolidayGroup('hg1', { dates: [{ name: 'Ano Novo', month: 1, day: 1 }] }))
            .rejects.toMatchObject({ statusCode: 400 })
    })

    it('fetches initial dates when url is just set', async () => {
        db.holidayGroup.findUnique.mockResolvedValue({ ...HG, url: null, dates: [] })
        db.flowEdge.findMany.mockResolvedValue([])
        db.holidayGroup.update.mockResolvedValue({ ...HG, url: 'https://example.com/feriados' })
        ;(fetchHolidaysFromUrl as any).mockResolvedValue([{ name: 'Natal', month: 12, day: 25 }])

        await HolidayGroupsService.updateHolidayGroup('hg1', { url: 'https://example.com/feriados' })

        expect(fetchHolidaysFromUrl).toHaveBeenCalledWith('https://example.com/feriados', expect.any(Number))
        expect(db.holidayDate.createMany).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.updateHolidayGroup('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteHolidayGroup ─────────────────────────────────────────────────────────
describe('HolidayGroupsService.deleteHolidayGroup', () => {
    it('deletes holiday group', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(HG)
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia — assertNotReferenced passa
        db.holidayGroup.delete.mockResolvedValue(HG)
        await HolidayGroupsService.deleteHolidayGroup('hg1')
        expect(db.holidayGroup.delete).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(null)
        await expect(HolidayGroupsService.deleteHolidayGroup('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.holidayGroup.findUnique.mockResolvedValue(HG)
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }])
        await expect(HolidayGroupsService.deleteHolidayGroup('hg1')).rejects.toMatchObject({ statusCode: 409 })
        expect(db.holidayGroup.delete).not.toHaveBeenCalled()
    })
})
