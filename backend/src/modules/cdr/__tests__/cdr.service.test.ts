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

const BASE_QUERY = { companyId: 'c1', limit: 50, page: 1, order: 'desc' } as any

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
        db.queue.findMany.mockResolvedValue([])
        db.queueCall.findMany.mockResolvedValue([])
        db.extension.findMany.mockResolvedValue([])

        const result = (await CdrService.getCdrByCompany(BASE_QUERY)) as any

        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ accountcode: 'ast1' }),
                orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
                take: 50,
                skip: 0
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
        expect(result.page).toBe(1)
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
            page: 3
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
                    // startDate/endDate cobrem o dia inteiro; sem conversão de tz - os dígitos já batem com o storage naive local
                    startTime: {
                        gte: new Date('2026-01-01T00:00:00.000Z'),
                        lte: new Date('2026-01-31T23:59:59.999Z')
                    }
                }),
                orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
                take: 50,
                skip: 100
            })
        )
    })

    it('resolves queueId to the internal Asterisk queue name', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findFirst.mockResolvedValue({ number: '600' })
        db.cdr.findMany.mockResolvedValue([])
        db.cdr.count.mockResolvedValue(0)

        await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            queueId: 'qxxxxxxxxxxxxxxxxxxxxxxxxx'
        })

        expect(db.queue.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'qxxxxxxxxxxxxxxxxxxxxxxxxx', companyId: 'c1' } })
        )
        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ queueName: 'ast1-600' })
            })
        )
    })

    it('throws 404 when queueId does not belong to the company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findFirst.mockResolvedValue(null)

        await expect(
            CdrService.getCdrByCompany({
                ...BASE_QUERY,
                queueId: 'qxxxxxxxxxxxxxxxxxxxxxxxxx'
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('applies skip based on page/limit and echoes the requested page', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([{ ...CDR_ROW, id: 2n }])
        db.cdr.count.mockResolvedValue(2)
        db.queue.findMany.mockResolvedValue([])
        db.queueCall.findMany.mockResolvedValue([])
        db.extension.findMany.mockResolvedValue([])

        const result = (await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            limit: 1,
            page: 2
        })) as any

        expect(db.cdr.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 1, skip: 1 })
        )
        expect(result.records).toHaveLength(1)
        expect(result.page).toBe(2)
    })

    it('enriches records with queue/flow labels and who answered, falling back to dst when queueName is null', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findMany.mockResolvedValue([
            {
                ...CDR_ROW,
                id: 1n,
                dst: 'abcdefghij-600',
                queueName: null,
                uniqueid: '1111.1'
            },
            {
                ...CDR_ROW,
                id: 2n,
                dst: 'node-abcdefghijklmnopqrstuvwx',
                queueName: null,
                uniqueid: '2222.2'
            }
        ])
        db.cdr.count.mockResolvedValue(2)
        db.queue.findMany.mockResolvedValue([{ name: 'Suporte', number: '600' }])
        db.flowNode.findMany.mockResolvedValue([
            {
                id: 'abcdefghijklmnopqrstuvwx',
                label: 'Entrada',
                type: 'ivr',
                flow: { name: 'Fluxo Principal' }
            }
        ])
        db.queueCall.findMany.mockResolvedValue([
            {
                callerUniqueid: '1111.1',
                agentExtensionId: 'ext1',
                agentExtension: { alias: '2002', name: 'João' },
                waitSeconds: 12,
                talkSeconds: 25
            }
        ])
        db.extension.findMany.mockResolvedValue([
            { number: '2001', alias: '2001', name: 'Recepção' }
        ])

        const result = (await CdrService.getCdrByCompany({
            ...BASE_QUERY,
            limit: 2
        })) as any

        expect(result.records[0]).toMatchObject({
            queueLabel: 'Suporte (600)',
            // destinationLabel fica null pra fila - a coluna "Fila" já cobre esse nome, repetir
            // em "Destino" seria redundante (ver comentário em cdr-enrichment.ts)
            destinationLabel: null,
            answeredBy: { extensionId: 'ext1', label: '2002 - João' },
            originLabel: '2001 - Recepção',
            queueWaitSeconds: 12,
            queueTalkSeconds: 25
        })
        expect(result.records[1]).toMatchObject({
            queueLabel: null,
            destinationLabel: 'Fluxo: Fluxo Principal - Entrada',
            answeredBy: null,
            originLabel: '2001 - Recepção',
            queueWaitSeconds: null,
            queueTalkSeconds: null
        })
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

describe('CdrService.getCdrRecordingPath', () => {
    it('returns the recording path when the record belongs to the company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findUnique.mockResolvedValue({
            accountcode: 'ast1',
            recordingFile: '/var/spool/asterisk/monitor/ast1/2026/07/28/call.wav'
        })

        const path = await CdrService.getCdrRecordingPath(1n, 'c1')

        expect(path).toBe('/var/spool/asterisk/monitor/ast1/2026/07/28/call.wav')
    })

    it('throws 404 when the cdr record does not exist', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findUnique.mockResolvedValue(null)

        await expect(
            CdrService.getCdrRecordingPath(1n, 'c1')
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when the record has no recording', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findUnique.mockResolvedValue({
            accountcode: 'ast1',
            recordingFile: null
        })

        await expect(
            CdrService.getCdrRecordingPath(1n, 'c1')
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when the record belongs to a different company (no leak)', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.cdr.findUnique.mockResolvedValue({
            accountcode: 'other-ast',
            recordingFile: '/var/spool/asterisk/monitor/other-ast/call.wav'
        })

        await expect(
            CdrService.getCdrRecordingPath(1n, 'c1')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
