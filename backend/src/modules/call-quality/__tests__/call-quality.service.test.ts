import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as CallQualityService from '../call-quality.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const ROW = {
    id: 'cq1', companyId: 'c1', trunkId: 't1', uniqueid: '1234.5', linkedid: '1234.1',
    callerNum: '18988096030', channel: 'PJSIP/ast1-trunk-1120-00000004',
    startAt: new Date(), endAt: new Date(), createdAt: new Date(),
    avgRxJitterUnits: 6, avgRxLostPct: 0, rxSamples: 4,
    avgTxJitterUnits: 10, avgTxLostPct: 0, txSamples: 4,
    avgRttSeconds: 0.006, rttSamples: 3,
    trunk: { name: '1120' },
}

const BASE_QUERY = { companyId: 'c1', limit: 50, page: 1, order: 'desc' } as any

beforeEach(() => clearPrismaMock(db))

describe('CallQualityService.recordCallQuality', () => {
    it('creates a CallQuality row with the given data', async () => {
        db.callQuality.create.mockResolvedValue(ROW)
        const input = {
            companyId: 'c1', trunkId: 't1', uniqueid: '1234.5', linkedid: '1234.1',
            callerNum: '18988096030', channel: 'PJSIP/ast1-trunk-1120-00000004',
            startAt: new Date(), endAt: new Date(),
            avgRxJitterUnits: 6, avgRxLostPct: 0, rxSamples: 4,
            avgTxJitterUnits: 10, avgTxLostPct: 0, txSamples: 4,
            avgRttSeconds: 0.006, rttSamples: 3,
        }
        await CallQualityService.recordCallQuality(input)
        expect(db.callQuality.create).toHaveBeenCalledWith({ data: input })
    })
})

describe('CallQualityService.getCallQualityList', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CallQualityService.getCallQualityList(BASE_QUERY))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('lists records scoped by companyId, flattening trunk name', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callQuality.findMany.mockResolvedValue([ROW])
        db.callQuality.count.mockResolvedValue(1)

        const result = await CallQualityService.getCallQualityList(BASE_QUERY)

        expect(result.total).toBe(1)
        expect(result.records[0]).toMatchObject({ id: 'cq1', trunkName: '1120' })
        expect(db.callQuality.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { companyId: 'c1' } })
        )
    })

    it('filters by trunkId and date range when provided', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callQuality.findMany.mockResolvedValue([])
        db.callQuality.count.mockResolvedValue(0)

        await CallQualityService.getCallQualityList({
            ...BASE_QUERY, trunkId: 't1', startDate: '2026-01-01', endDate: '2026-01-31',
        })

        expect(db.callQuality.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    companyId: 'c1',
                    trunkId: 't1',
                    startAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T23:59:59.999Z') },
                },
            })
        )
    })
})

describe('CallQualityService.getCallQualitySummary', () => {
    it('returns averages and total calls for the period', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.callQuality.count.mockResolvedValue(3)
        db.callQuality.aggregate.mockResolvedValue({
            _avg: {
                avgRxJitterUnits: 5, avgRxLostPct: 0.1,
                avgTxJitterUnits: 8, avgTxLostPct: 0.2,
                avgRttSeconds: 0.01,
            },
        })

        const result = await CallQualityService.getCallQualitySummary(BASE_QUERY)

        expect(result.summary).toEqual({
            totalCalls: 3,
            avgRxJitterUnits: 5, avgRxLostPct: 0.1,
            avgTxJitterUnits: 8, avgTxLostPct: 0.2,
            avgRttSeconds: 0.01,
        })
    })
})
