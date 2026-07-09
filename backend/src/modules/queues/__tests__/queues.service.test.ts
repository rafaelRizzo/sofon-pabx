import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/queues.cache', () => ({
    QueuesCache: {
        getAll: mock(() => null), setAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getForScope: mock(() => null), setForScope: mock(),
        getQueue: mock(() => null), setQueue: mock(),
        invalidateQueue: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
        invalidateAll: mock(),
    },
}))
mock.module('../../queue-members/cache/queue-members.cache', () => ({
    QueueMembersCache: {
        getMembers: mock(() => null), setMembers: mock(), invalidateMembers: mock(),
    },
}))
mock.module('../../../asterisk/queue.repository', () => ({
    AsteriskQueueRepository: {
        createQueue: mock(() => Promise.resolve()),
        updateQueue: mock(() => Promise.resolve()),
        renameQueue: mock(() => Promise.resolve()),
        deleteQueue: mock(() => Promise.resolve()),
        addMember: mock(() => Promise.resolve()),
        updateMember: mock(() => Promise.resolve()),
        removeMember: mock(() => Promise.resolve()),
        removeMembersByInterfaces: mock(() => Promise.resolve()),
        deleteManyQueues: mock(() => Promise.resolve()),
        regenerate: mock(() => Promise.resolve()),
    },
    toAsteriskQueueName: (asteriskId: string, queueName: string) => `${asteriskId}-${queueName}`,
}))

import * as QueuesService from '../queues.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const QUEUE = {
    id: 'q1', name: 'suporte', number: null, companyId: 'c1',
    strategy: 'ringall', musicOnHold: 'default', timeout: 15, retry: 5,
    maxLen: 0, wrapupTime: 0, announce: null, announceFrequency: 0,
    joinEmpty: true, leaveWhenEmpty: false, weight: 0, metadata: {},
    createdAt: new Date(), updatedAt: new Date(),
    company: { asteriskId: 'ast1' },
    _count: { members: 0 },
}

beforeEach(() => clearPrismaMock(db))

// ─── createQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.createQueue', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(QueuesService.createQueue({
            name: 'test', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', number: '8000',
            strategy: 'ringall', musicOnHold: 'default', timeout: 15, retry: 5,
            maxLen: 0, wrapupTime: 0, announceFrequency: 0, announcePosition: false,
            periodicAnnounceFrequency: 60, joinEmpty: true, leaveWhenEmpty: false, weight: 0,
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValue(QUEUE)
        await expect(QueuesService.createQueue({
            name: 'suporte', companyId: 'c1', number: '8001',
            strategy: 'ringall', musicOnHold: 'default', timeout: 15, retry: 5,
            maxLen: 0, wrapupTime: 0, announceFrequency: 0, announcePosition: false,
            periodicAnnounceFrequency: 60, joinEmpty: true, leaveWhenEmpty: false, weight: 0,
        }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates queue with defaults', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
        db.queue.create.mockResolvedValue(QUEUE)

        const queue = await QueuesService.createQueue({ name: 'suporte', companyId: 'c1', number: '8001' } as any) as any
        expect(queue.name).toBe('suporte')
        expect(queue.strategy).toBe('ringall')
    })

    it('throws 409 with duplicate number in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(QUEUE)
        await expect(QueuesService.createQueue({ name: 'suporte2', companyId: 'c1', number: '8001' } as any))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('syncs dialplan with postQueueDestination', async () => {
        const { AsteriskQueueRepository } = await import('../../../asterisk/queue.repository')
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
        db.queue.create.mockResolvedValue(QUEUE)
        await QueuesService.createQueue({
            name: 'suporte', companyId: 'c1', number: '8001', postQueueDestination: { type: 'hangup' },
        } as any)
        expect(AsteriskQueueRepository.regenerate).toHaveBeenCalledWith('c1')
    })
})

// ─── getQueuesByCompany ───────────────────────────────────────────────────────
describe('QueuesService.getQueuesByCompany', () => {
    it('returns list of queues', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findMany.mockResolvedValue([QUEUE])
        const queues = await QueuesService.getQueuesByCompany('c1') as any[]
        expect(Array.isArray(queues)).toBe(true)
        expect(queues[0].id).toBe('q1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(QueuesService.getQueuesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getQueueById ─────────────────────────────────────────────────────────────
describe('QueuesService.getQueueById', () => {
    it('returns queue', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        const queue = await QueuesService.getQueueById('q1') as any
        expect(queue.id).toBe('q1')
    })

    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(QueuesService.getQueueById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.updateQueue', () => {
    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(QueuesService.updateQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx', { timeout: 10 }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates queue', async () => {
        db.queue.findUnique.mockResolvedValueOnce(QUEUE).mockResolvedValueOnce({ ...QUEUE, timeout: 30 })
        db.queue.update.mockResolvedValue({ ...QUEUE, timeout: 30 })
        const queue = await QueuesService.updateQueue('q1', { timeout: 30 }) as any
        expect(queue.timeout).toBe(30)
    })

    it('resyncs dialplan when only postQueueDestination changes', async () => {
        const { AsteriskQueueRepository } = await import('../../../asterisk/queue.repository')
        const existing = { ...QUEUE, number: '8000' }
        db.queue.findUnique.mockResolvedValueOnce(existing)
        db.queue.update.mockResolvedValue({ ...existing, postQueueDestination: { type: 'hangup' } })
        await QueuesService.updateQueue('q1', { postQueueDestination: { type: 'hangup' } })
        expect(AsteriskQueueRepository.regenerate).toHaveBeenCalledWith('c1')
    })
})

// ─── deleteQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.deleteQueue', () => {
    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(QueuesService.deleteQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

