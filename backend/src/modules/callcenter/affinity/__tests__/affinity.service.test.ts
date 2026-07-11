import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../../asterisk/queue.repository', () => ({
    toAsteriskInterface: (type: string, number: string) => `${type.toUpperCase()}/${number}`,
}))

import * as AffinityService from '../affinity.service'

beforeEach(() => clearPrismaMock(db))

describe('AffinityService.recalculateAffinity', () => {
    it('upserts AgentAffinity from CallRating averages and recalcs penalties for affected companies', async () => {
        db.callRating.groupBy.mockResolvedValue([
            { extensionId: 'e1', companyId: 'c1', _avg: { score: 4.5 }, _count: { score: 2 } },
        ])
        db.agentAffinity.upsert.mockResolvedValue({})
        db.queue.findMany.mockResolvedValue([])

        const result = await AffinityService.recalculateAffinity()

        expect(db.agentAffinity.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { extensionId_companyId: { extensionId: 'e1', companyId: 'c1' } },
            update: { score: 4.5, sampleSize: 2 },
            create: { extensionId: 'e1', companyId: 'c1', score: 4.5, sampleSize: 2 },
        }))
        expect(result).toEqual({ companies: 1, agents: 1 })
    })

    it('returns zero when there are no ratings', async () => {
        db.callRating.groupBy.mockResolvedValue([])
        const result = await AffinityService.recalculateAffinity()
        expect(result).toEqual({ companies: 0, agents: 0 })
        expect(db.queue.findMany).not.toHaveBeenCalled()
    })
})

describe('AffinityService.recalculatePenaltiesForCompany', () => {
    it('ranks members by affinity score desc (best affinity = lowest penalty)', async () => {
        db.queue.findMany.mockResolvedValue([{
            name: 'suporte',
            company: { asteriskId: 'ast1' },
            members: [
                { extensionId: 'e-low', extension: { type: 'pjsip', number: '2001_ast1' } },
                { extensionId: 'e-high', extension: { type: 'pjsip', number: '2002_ast1' } },
            ],
        }])
        db.agentAffinity.findMany.mockResolvedValue([
            { extensionId: 'e-low', score: 1.0 },
            { extensionId: 'e-high', score: 4.8 },
        ])

        await AffinityService.recalculatePenaltiesForCompany('c1')

        expect(db.queue_members.updateMany).toHaveBeenCalledWith({
            where: { queue_name: 'ast1-suporte', interface: 'PJSIP/2002_ast1' },
            data: { penalty: 0 },
        })
        expect(db.queue_members.updateMany).toHaveBeenCalledWith({
            where: { queue_name: 'ast1-suporte', interface: 'PJSIP/2001_ast1' },
            data: { penalty: 1 },
        })
    })

    it('skips queues with no members', async () => {
        db.queue.findMany.mockResolvedValue([{ name: 'vazia', company: { asteriskId: 'ast1' }, members: [] }])
        await AffinityService.recalculatePenaltiesForCompany('c1')
        expect(db.queue_members.updateMany).not.toHaveBeenCalled()
    })
})
