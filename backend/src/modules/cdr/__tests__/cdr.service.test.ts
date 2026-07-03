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

const BASE_QUERY = { companyId: 'c1', limit: 50, offset: 0 } as any

beforeEach(() => clearPrismaMock(db))

// ─── getCdrByCompany ──────────────────────────────────────────────────────────
describe('CdrService.getCdrByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CdrService.getCdrByCompany({ ...BASE_QUERY, companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns records scoped by accountcode with total/limit/offset', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([CDR_ROW])
        db.cdr.count.mockResolvedValue(1)

        const result = await CdrService.getCdrByCompany(BASE_QUERY) as any

        expect(db.cdr.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ accountcode: 'ast1' }),
        }))
        expect(result.records[0].id).toBe('1')
        expect(result.total).toBe(1)
        expect(result.limit).toBe(50)
        expect(result.offset).toBe(0)
    })

    it('applies src/dst/disposition/date filters', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([])
        db.cdr.count.mockResolvedValue(0)

        await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            src: '2001', dst: '2002', disposition: 'ANSWERED',
            startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z',
        })

        expect(db.cdr.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                accountcode: 'ast1',
                src: { contains: '2001' },
                dst: { contains: '2002' },
                disposition: 'ANSWERED',
                startTime: { gte: new Date('2026-01-01T00:00:00Z'), lte: new Date('2026-01-31T23:59:59Z') },
            }),
        }))
    })
})
