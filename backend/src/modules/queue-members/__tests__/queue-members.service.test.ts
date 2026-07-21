import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../queues/cache/queues.cache', () => ({
    QueuesCache: {
        getQueue: mock(() => null), setQueue: mock(),
        invalidateQueue: mock(), invalidateByCompany: mock(), invalidateAll: mock(),
    },
}))
mock.module('../cache/queue-members.cache', () => ({
    QueueMembersCache: {
        getMembers: mock(() => null), setMembers: mock(), invalidateMembers: mock(),
    },
}))
mock.module('../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { getExtension: mock(() => null), setExtension: mock() },
}))
mock.module('../../../asterisk/queue.repository', () => ({
    AsteriskQueueRepository: {
        addMember: mock(() => Promise.resolve()),
        updateMember: mock(() => Promise.resolve()),
        removeMember: mock(() => Promise.resolve()),
    },
    toAsteriskInterface: (type: string, number: string) => `${type.toUpperCase()}/${number}`,
}))

import * as QueueMembersService from '../queue-members.service'

const QUEUE = { id: 'q1', name: 'suporte', companyId: 'c1', company: { asteriskId: 'ast1' } }
const EXT = { id: 'e1', name: 'Agent', number: '2001_ast1', type: 'pjsip', companyId: 'c1' }
const MEMBER = {
    id: 'm1', queueId: 'q1', extensionId: 'e1', penalty: 0, paused: false,
    createdAt: new Date(), updatedAt: new Date(),
    extension: { id: 'e1', name: 'Agent', number: '2001_ast1', alias: '2001', type: 'pjsip', companyId: 'c1' },
}
const MEMBER_WITH_RELATIONS = {
    ...MEMBER,
    queue: { name: 'suporte', company: { asteriskId: 'ast1' } },
    extension: { number: '2001_ast1', type: 'pjsip' },
}

beforeEach(() => clearPrismaMock(db))

// ─── getQueueMembers ────────────────────────────────────────────────────────
describe('QueueMembersService.getQueueMembers', () => {
    it('throws 404 with non-existent queue', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.getQueueMembers('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns members list', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.queueMember.findMany.mockResolvedValue([MEMBER])
        const members = await QueueMembersService.getQueueMembers('q1') as any[]
        expect(members[0].id).toBe('m1')
    })
})

// ─── addMember ──────────────────────────────────────────────────────────────
describe('QueueMembersService.addMember', () => {
    it('throws 404 when queue not found', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.addMember('clxxxxxxxxxxxxxxxxxxxxxxxxx', { extensionId: 'e1', penalty: 0, paused: false }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when extension not found', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.addMember('q1', { extensionId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', penalty: 0, paused: false }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when extension belongs to different company', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue({ ...EXT, companyId: 'other-company' })
        await expect(QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 409 when already a member', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(EXT)
        db.queueMember.findUnique.mockResolvedValue(MEMBER)
        await expect(QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('adds member', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(EXT)
        db.queueMember.findUnique.mockResolvedValue(null)
        db.queueMember.create.mockResolvedValue(MEMBER)
        const member = await QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }) as any
        expect(member.extensionId).toBe('e1')
    })

    it('allows add when company has no AgentCompanyScope at all (opt-in, backward compatible)', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(EXT)
        db.agentCompanyScope.findFirst.mockResolvedValue(null)
        db.queueMember.findUnique.mockResolvedValue(null)
        db.queueMember.create.mockResolvedValue(MEMBER)
        const member = await QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }) as any
        expect(member.extensionId).toBe('e1')
    })

    it('throws 403 when company opted into scopes and extension has no active scope', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(EXT)
        db.agentCompanyScope.findFirst.mockResolvedValue({ id: 's1' })
        db.agentCompanyScope.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('allows add when company opted into scopes and extension has an active scope', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        db.extension.findUnique.mockResolvedValue(EXT)
        db.agentCompanyScope.findFirst.mockResolvedValue({ id: 's1' })
        db.agentCompanyScope.findUnique.mockResolvedValue({ id: 's1', extensionId: 'e1', companyId: 'c1', active: true })
        db.queueMember.findUnique.mockResolvedValue(null)
        db.queueMember.create.mockResolvedValue(MEMBER)
        const member = await QueueMembersService.addMember('q1', { extensionId: 'e1', penalty: 0, paused: false }) as any
        expect(member.extensionId).toBe('e1')
    })
})

// ─── updateMember ───────────────────────────────────────────────────────────
describe('QueueMembersService.updateMember', () => {
    it('throws 404 when member not found', async () => {
        db.queueMember.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.updateMember('q1', 'clxxxxxxxxxxxxxxxxxxxxxxxxx', { penalty: 1 }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when member belongs to a different queue', async () => {
        db.queueMember.findUnique.mockResolvedValue({ ...MEMBER_WITH_RELATIONS, queueId: 'other-queue' })
        await expect(QueueMembersService.updateMember('q1', 'm1', { penalty: 1 }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates member penalty', async () => {
        db.queueMember.findUnique.mockResolvedValue(MEMBER_WITH_RELATIONS)
        db.queueMember.update.mockResolvedValue({ ...MEMBER, penalty: 5 })
        const updated = await QueueMembersService.updateMember('q1', 'm1', { penalty: 5 }) as any
        expect(updated.penalty).toBe(5)
    })
})

// ─── removeMember ───────────────────────────────────────────────────────────
describe('QueueMembersService.removeMember', () => {
    it('throws 404 when member not found', async () => {
        db.queueMember.findUnique.mockResolvedValue(null)
        await expect(QueueMembersService.removeMember('q1', 'clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('removes member', async () => {
        db.queueMember.findUnique.mockResolvedValue(MEMBER_WITH_RELATIONS)
        db.queueMember.delete.mockResolvedValue(MEMBER)
        await QueueMembersService.removeMember('q1', 'm1')
        expect(db.queueMember.delete).toHaveBeenCalledWith({ where: { id: 'm1' } })
    })
})
