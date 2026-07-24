import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as QueueCallsService from '../queue-calls.service'

const COMPANY = { id: 'c1', asteriskId: 'a9e2463c8f' }
const QUEUE_NAME = 'a9e2463c8f-600'

beforeEach(() => clearPrismaMock(db))

describe('QueueCallsService.listQueueCalls', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(QueueCallsService.listQueueCalls({ companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', limit: 50 } as any))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns nextCursor null when there are no more records', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.findMany.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }])

        const result = await QueueCallsService.listQueueCalls({ companyId: 'c1', limit: 50 } as any)

        expect(db.queueCall.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ companyId: 'c1' }),
            orderBy: [{ enteredAt: 'desc' }, { id: 'desc' }],
            take: 51,
        }))
        expect(result.records).toHaveLength(2)
        expect(result.nextCursor).toBeNull()
    })

    it('returns nextCursor when there are more records than limit', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.findMany.mockResolvedValue([{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }])

        const result = await QueueCallsService.listQueueCalls({ companyId: 'c1', limit: 2 } as any)

        expect(result.records).toHaveLength(2)
        expect(result.nextCursor).toBe('q2')
    })

    it('applies cursor with skip:1', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.findMany.mockResolvedValue([])

        await QueueCallsService.listQueueCalls({ companyId: 'c1', limit: 50, cursor: 'q2' } as any)

        expect(db.queueCall.findMany).toHaveBeenCalledWith(expect.objectContaining({
            cursor: { id: 'q2' },
            skip: 1,
        }))
    })

    it('applies queueId/outcome/agentExtensionId/date filters', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.findMany.mockResolvedValue([])

        await QueueCallsService.listQueueCalls({
            companyId: 'c1', queueId: 'qu1', outcome: 'answered', agentExtensionId: 'e1',
            startDate: '2026-01-01', endDate: '2026-01-31', limit: 50,
        } as any)

        expect(db.queueCall.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                companyId: 'c1', queueId: 'qu1', outcome: 'answered', agentExtensionId: 'e1',
                enteredAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T23:59:59.999Z') },
            }),
        }))
    })
})

describe('QueueCallsService.getQueueCallMetrics', () => {
    it('computes rates from counts/aggregates/median', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.count
            .mockResolvedValueOnce(10) // offered
            .mockResolvedValueOnce(6)  // answered
            .mockResolvedValueOnce(3)  // abandoned
            .mockResolvedValueOnce(4)  // slaCompliant
        db.queueCall.aggregate
            .mockResolvedValueOnce({ _avg: { waitSeconds: 12.5 } })
            .mockResolvedValueOnce({ _avg: { talkSeconds: 90 } })
        db.queueCall.groupBy.mockResolvedValue([
            { agentExtensionId: 'e1', _count: { _all: 4 }, _avg: { talkSeconds: 80 } },
        ])
        db.$queryRaw.mockResolvedValue([{ median: 10 }])

        const { metrics } = await QueueCallsService.getQueueCallMetrics({ companyId: 'c1', slaSeconds: 20 } as any)

        expect(metrics.offered).toBe(10)
        expect(metrics.answered).toBe(6)
        expect(metrics.abandoned).toBe(3)
        expect(metrics.abandonRate).toBeCloseTo(0.3)
        expect(metrics.slaCompliant).toBe(4)
        expect(metrics.slaRate).toBeCloseTo(4 / 6)
        expect(metrics.avgWaitSeconds).toBe(12.5)
        expect(metrics.medianWaitSeconds).toBe(10)
        expect(metrics.avgTalkSeconds).toBe(90)
        expect(metrics.byAgent).toEqual([{ agentExtensionId: 'e1', calls: 4, avgTalkSeconds: 80 }])
    })

    it('handles zero offered/answered without dividing by zero', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.count.mockResolvedValue(0)
        db.queueCall.aggregate.mockResolvedValue({ _avg: {} })
        db.queueCall.groupBy.mockResolvedValue([])
        db.$queryRaw.mockResolvedValue([{ median: null }])

        const { metrics } = await QueueCallsService.getQueueCallMetrics({ companyId: 'c1', slaSeconds: 20 } as any)

        expect(metrics.abandonRate).toBe(0)
        expect(metrics.slaRate).toBe(0)
        expect(metrics.medianWaitSeconds).toBeNull()
    })
})

describe('QueueCallsService.recordJoin', () => {
    it('no-ops when queueName cannot be parsed', async () => {
        await QueueCallsService.recordJoin({ queueName: 'invalid', callerUniqueid: '1.1' })
        expect(db.queueCall.upsert).not.toHaveBeenCalled()
    })

    it('no-ops when company/queue cannot be resolved', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await QueueCallsService.recordJoin({ queueName: QUEUE_NAME, callerUniqueid: '1.1' })
        expect(db.queueCall.upsert).not.toHaveBeenCalled()
    })

    it('upserts by callerUniqueid_queueName with resolved company/queue', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValue({ id: 'qu1' })
        db.queueCall.upsert.mockResolvedValue({})

        await QueueCallsService.recordJoin({ queueName: QUEUE_NAME, callerUniqueid: '1.1', src: '1199998888', position: 2 })

        expect(db.queueCall.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { callerUniqueid_queueName: { callerUniqueid: '1.1', queueName: QUEUE_NAME } },
            create: expect.objectContaining({ companyId: 'c1', queueId: 'qu1', src: '1199998888', initialPosition: 2 }),
            update: {},
        }))
    })

    it('swallows errors and never throws', async () => {
        db.company.findUnique.mockRejectedValue(new Error('db down'))
        await expect(QueueCallsService.recordJoin({ queueName: QUEUE_NAME, callerUniqueid: '1.1' })).resolves.toBeUndefined()
    })
})

describe('QueueCallsService.recordAgentConnect', () => {
    it('resolves agentExtensionId from the member interface and guards on connectedAt:null', async () => {
        db.extension.findUnique.mockResolvedValue({ id: 'e1' })
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })

        await QueueCallsService.recordAgentConnect({
            queueName: QUEUE_NAME, callerUniqueid: '1.1', agentInterface: 'PJSIP/2002_ast1', holdTimeSeconds: 15,
        })

        expect(db.extension.findUnique).toHaveBeenCalledWith({ where: { number: '2002_ast1' }, select: { id: true } })
        expect(db.queueCall.updateMany).toHaveBeenCalledWith({
            where: { callerUniqueid: '1.1', queueName: QUEUE_NAME, connectedAt: null },
            data: { connectedAt: expect.any(Date), waitSeconds: 15, agentInterface: 'PJSIP/2002_ast1', agentExtensionId: 'e1' },
        })
    })
})

describe('QueueCallsService.recordAnswered / recordAbandoned', () => {
    it('recordAnswered guards on endedAt:null and sets outcome=answered', async () => {
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })
        await QueueCallsService.recordAnswered({ queueName: QUEUE_NAME, callerUniqueid: '1.1', talkTimeSeconds: 42, reason: 'caller' })
        expect(db.queueCall.updateMany).toHaveBeenCalledWith({
            where: { callerUniqueid: '1.1', queueName: QUEUE_NAME, endedAt: null },
            data: { endedAt: expect.any(Date), outcome: 'answered', talkSeconds: 42, exitReason: 'caller' },
        })
    })

    it('recordAbandoned guards on endedAt:null and sets outcome=abandoned', async () => {
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })
        await QueueCallsService.recordAbandoned({ queueName: QUEUE_NAME, callerUniqueid: '1.1', holdTimeSeconds: 8, position: 3 })
        expect(db.queueCall.updateMany).toHaveBeenCalledWith({
            where: { callerUniqueid: '1.1', queueName: QUEUE_NAME, endedAt: null },
            data: { endedAt: expect.any(Date), outcome: 'abandoned', waitSeconds: 8, finalPosition: 3 },
        })
    })
})

describe('QueueCallsService.finalizeByQueueStatus', () => {
    it('no-ops when queueStatus is empty (already answered, handled via AMI)', async () => {
        await QueueCallsService.finalizeByQueueStatus({ queueId: 'qu1', callerUniqueid: '1.1', queueStatus: '' })
        expect(db.queue.findUnique).not.toHaveBeenCalled()
    })

    it('maps TIMEOUT to outcome=timeout', async () => {
        db.queue.findUnique.mockResolvedValue({ companyId: 'c1', number: '600' })
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })

        await QueueCallsService.finalizeByQueueStatus({ queueId: 'qu1', callerUniqueid: '1.1', queueStatus: 'TIMEOUT' })

        expect(db.queueCall.updateMany).toHaveBeenCalledWith({
            where: { callerUniqueid: '1.1', queueName: QUEUE_NAME, endedAt: null },
            data: { endedAt: expect.any(Date), outcome: 'timeout' },
        })
    })

    it.each(['FULL', 'JOINEMPTY', 'JOINUNAVAIL', 'LEAVEEMPTY', 'LEAVEUNAVAIL'])('maps %s to outcome=empty', async (status) => {
        db.queue.findUnique.mockResolvedValue({ companyId: 'c1', number: '600' })
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })

        await QueueCallsService.finalizeByQueueStatus({ queueId: 'qu1', callerUniqueid: '1.1', queueStatus: status })

        expect(db.queueCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { endedAt: expect.any(Date), outcome: 'empty' } }))
    })

    it('maps unrecognized non-empty status to outcome=failed', async () => {
        db.queue.findUnique.mockResolvedValue({ companyId: 'c1', number: '600' })
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queueCall.updateMany.mockResolvedValue({ count: 1 })

        await QueueCallsService.finalizeByQueueStatus({ queueId: 'qu1', callerUniqueid: '1.1', queueStatus: 'SOMETHING_ELSE' })

        expect(db.queueCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { endedAt: expect.any(Date), outcome: 'failed' } }))
    })
})
