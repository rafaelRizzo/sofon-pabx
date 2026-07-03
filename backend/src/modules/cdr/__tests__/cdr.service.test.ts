import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as CdrService from '../cdr.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const CDR_ROW = {
    id: 1n, src: '2001', dst: '2002', context: 'ramais', callerid: '"Agent" <2001>',
    srcChannel: 'PJSIP/2001-00000001', dstChannel: 'PJSIP/2002-00000002',
    lastApp: 'Dial', lastData: 'PJSIP/2002',
    startTime: new Date(), answerTime: new Date(), endTime: new Date(),
    duration: 30, billsec: 25, disposition: 'ANSWERED', uniqueid: '1234.5',
}

const BASE_QUERY = { companyId: 'c1', limit: 50, order: 'desc' } as any

beforeEach(() => clearPrismaMock(db))

// ─── getCdrByCompany ──────────────────────────────────────────────────────────
describe('CdrService.getCdrByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CdrService.getCdrByCompany({ ...BASE_QUERY, companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns records scoped by accountcode with total/limit', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([CDR_ROW])
        db.cdr.count.mockResolvedValue(1)

        const result = await CdrService.getCdrByCompany(BASE_QUERY) as any

        expect(db.cdr.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ accountcode: 'ast1' }),
            orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
        }))
        expect(db.cdr.count).toHaveBeenCalledWith({ where: expect.objectContaining({ accountcode: 'ast1' }) })
        expect(result.records[0].id).toBe('1')
        expect(result.records[0].callStatus).toBe('ANSWERED')
        expect(result.total).toBe(1)
        expect(result.limit).toBe(50)
    })

    it('applies src/dst/callStatus/date filters and honors order=asc', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([])
        db.cdr.count.mockResolvedValue(0)

        await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            src: '2001', dst: '2002', callStatus: 'ANSWERED', order: 'asc',
            startDate: '2026-01-01', endDate: '2026-01-31',
        })

        expect(db.cdr.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                accountcode: 'ast1',
                src: { contains: '2001' },
                dst: { contains: '2002' },
                disposition: 'ANSWERED',
                // startDate/endDate cobrem o dia inteiro; sem conversão de tz — os dígitos já batem com o storage naive local
                startTime: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T23:59:59.999Z') },
            }),
            orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
        }))
    })

})
