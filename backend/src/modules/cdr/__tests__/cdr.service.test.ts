import { mock, describe, it, expect, beforeEach } from 'bun:test'
import {
    createPrismaMock,
    clearPrismaMock
} from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() }
}))

import * as CdrService from '../cdr.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const CDR_ROW = {
    id: 1n,
    src: '2001',
    dst: '2002',
    context: 'ramais',
    callerid: '"Agent" <2001>',
    srcChannel: 'PJSIP/2001-00000001',
    dstChannel: 'PJSIP/2002-00000002',
    lastApp: 'Dial',
    lastData: 'PJSIP/2002',
    startTime: new Date(),
    answerTime: new Date(),
    endTime: new Date(),
    duration: 30,
    billsec: 25,
    disposition: 'ANSWERED',
    uniqueid: '1234.5',
    queueName: 'ast1-queue-100',
    linkedid: '1234.1',
    sequence: 1,
    direction: 'outbound',
    originExtension: '2001',
    dialedNumber: '5511999999999',
    trunkId: 'trxxxxxxxxxxxxxxxxxxxxxx',
    recordingFile: 'call.wav',
    hangupCause: '16'
}

const BASE_QUERY = { companyId: 'c1', limit: 50, order: 'desc' } as any

beforeEach(() => clearPrismaMock(db))

// ─── getCdrByCompany ──────────────────────────────────────────────────────────
describe('CdrService.getCdrByCompany', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(
            CdrService.getCdrByCompany({
                ...BASE_QUERY,
                companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx'
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns records scoped by accountcode with total/limit', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([CDR_ROW])
        db.cdr.count.mockResolvedValue(1)

        const result = (await CdrService.getCdrByCompany(BASE_QUERY)) as any

        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ accountcode: 'ast1' }),
                orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
                take: 51
            })
        )
        expect(db.cdr.count).toHaveBeenCalledWith({
            where: expect.objectContaining({ accountcode: 'ast1' })
        })
        expect(result.records[0].id).toBe('1')
        expect(result.records[0].callStatus).toBe('ANSWERED')
        expect(result.records[0]).toMatchObject({
            direction: 'outbound',
            originExtension: '2001',
            dialedNumber: '5511999999999',
            trunkId: 'trxxxxxxxxxxxxxxxxxxxxxx',
            queueName: 'ast1-queue-100',
            linkedid: '1234.1',
            recordingFile: 'call.wav',
            hangupCause: '16'
        })
        expect(result.nextCursor).toBeNull()
        expect(result.total).toBe(1)
        expect(result.limit).toBe(50)
    })

    it('applies src/dst/callStatus/date filters and honors order=asc', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([])
        db.cdr.count.mockResolvedValue(0)

        await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            src: '2001',
            dst: '2002',
            callStatus: 'ANSWERED',
            order: 'asc',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            direction: 'outbound',
            originExtension: '2001',
            dialedNumber: '5511999999999',
            trunkId: 'trxxxxxxxxxxxxxxxxxxxxxx',
            queueName: 'ast1-queue-100',
            linkedid: '1234.1',
            uniqueid: '1234.5',
            cursor: 99n
        })

        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    accountcode: 'ast1',
                    src: { contains: '2001' },
                    dst: { contains: '2002' },
                    disposition: 'ANSWERED',
                    direction: 'outbound',
                    originExtension: { contains: '2001' },
                    dialedNumber: { contains: '5511999999999' },
                    trunkId: 'trxxxxxxxxxxxxxxxxxxxxxx',
                    queueName: 'ast1-queue-100',
                    linkedid: '1234.1',
                    uniqueid: '1234.5',
                    // startDate/endDate cobrem o dia inteiro; sem conversão de tz — os dígitos já batem com o storage naive local
                    startTime: {
                        gte: new Date('2026-01-01T00:00:00.000Z'),
                        lte: new Date('2026-01-31T23:59:59.999Z')
                    }
                }),
                orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
                cursor: { id: 99n },
                skip: 1
            })
        )
    })

    it('returns a cursor when a page has more records', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([
            { ...CDR_ROW, id: 1n },
            { ...CDR_ROW, id: 2n }
        ])
        db.cdr.count.mockResolvedValue(2)

        const result = (await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            limit: 1
        })) as any

        expect(result.records).toHaveLength(1)
        expect(result.nextCursor).toBe('1')
    })
})

describe('CdrService.getCdrMetricsByCompany', () => {
    it('aggregates CDR metrics using the requested filters', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.count.mockResolvedValueOnce(10).mockResolvedValueOnce(6)
        db.cdr.aggregate.mockResolvedValue({
            _sum: { duration: 300, billsec: 180 },
            _avg: { duration: 30, billsec: 18 }
        })
        db.cdr.groupBy
            .mockResolvedValueOnce([
                { disposition: 'ANSWERED', _count: { _all: 6 } }
            ])
            .mockResolvedValueOnce([
                { direction: 'outbound', _count: { _all: 8 } }
            ])

        const { metrics } = await CdrService.getCdrMetricsByCompany({
            companyId: 'c1',
            direction: 'outbound',
            startDate: '2026-01-01',
            endDate: '2026-01-31'
        } as any)

        expect(db.cdr.count).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({
                    accountcode: 'ast1',
                    direction: 'outbound'
                })
            })
        )
        expect(metrics).toMatchObject({
            total: 10,
            answered: 6,
            answerRate: 0.6,
            totalDuration: 300,
            totalBillsec: 180,
            avgDuration: 30,
            avgBillsec: 18,
            byStatus: [{ callStatus: 'ANSWERED', calls: 6 }],
            byDirection: [{ direction: 'outbound', calls: 8 }]
        })
    })

    it('returns zero rates and totals for an empty result', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.count.mockResolvedValue(0)
        db.cdr.aggregate.mockResolvedValue({ _sum: {}, _avg: {} })
        db.cdr.groupBy.mockResolvedValue([])

        const { metrics } = await CdrService.getCdrMetricsByCompany({
            companyId: 'c1'
        } as any)

        expect(metrics).toMatchObject({
            total: 0,
            answered: 0,
            answerRate: 0,
            totalDuration: 0,
            totalBillsec: 0,
            avgDuration: undefined,
            avgBillsec: undefined,
            byStatus: [],
            byDirection: []
        })
    })
})
