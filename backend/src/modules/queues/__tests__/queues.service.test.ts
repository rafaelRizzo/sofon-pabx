import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as QueuesService from '../queues.service'

const PREFIX = `__test_queues_svc_${Date.now()}__`

let userId: string
let companyId: string
let companyAsteriskId: string
let extensionId: string
let queueId: string
let memberId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: { name: 'Test', username: `${PREFIX}@test.com`, password: 'x', role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: { name: `${PREFIX} Company`, metadata: {}, users: { create: { userId } } },
    })
    companyId = company.id
    companyAsteriskId = company.asteriskId

    const ext = await prisma.extension.create({
        data: { alias: PREFIX.slice(0, 10), number: '9001', type: 'pjsip', name: 'Agent', companyId },
    })
    extensionId = ext.id
})

afterAll(async () => {
    await prisma.queue_members.deleteMany({ where: { queue_name: { startsWith: companyAsteriskId } } }).catch(() => {})
    await prisma.queues.deleteMany({ where: { name: { startsWith: companyAsteriskId } } }).catch(() => {})
    await prisma.queueMember.deleteMany({ where: { queue: { companyId } } })
    await prisma.queue.deleteMany({ where: { companyId } })
    await prisma.extension.deleteMany({ where: { companyId } })
    await prisma.userCompany.deleteMany({ where: { userId } })
    await teardownTestEnv(PREFIX)
})

// ─── createQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.createQueue', () => {
    it('creates queue with defaults and syncs to asterisk', async () => {
        const queue = await QueuesService.createQueue({ name: 'suporte', companyId }) as any
        queueId = queue.id

        expect(queue.name).toBe('suporte')
        expect(queue.strategy).toBe('ringall')
        expect(queue.musicOnHold).toBe('default')
        expect(queue.timeout).toBe(15)
        expect(queue.retry).toBe(5)
        expect(queue.companyId).toBe(companyId)

        const astQueue = await prisma.queues.findUnique({ where: { name: `${companyAsteriskId}-suporte` } })
        expect(astQueue).not.toBeNull()
        expect(astQueue?.strategy).toBe('ringall')
    })

    it('creates queue with custom options', async () => {
        const queue = await QueuesService.createQueue({
            name: 'vendas',
            companyId,
            strategy: 'rrmemory',
            timeout: 25,
            retry: 8,
            joinEmpty: false,
            leaveWhenEmpty: true,
        }) as any

        expect(queue.strategy).toBe('rrmemory')
        expect(queue.timeout).toBe(25)

        await QueuesService.deleteQueue(queue.id)
    })

    it('throws 409 with duplicate name in same company', async () => {
        await expect(
            QueuesService.createQueue({ name: 'suporte', companyId })
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        await expect(
            QueuesService.createQueue({ name: 'test', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getQueuesByCompany ───────────────────────────────────────────────────────
describe('QueuesService.getQueuesByCompany', () => {
    it('returns list of queues', async () => {
        const queues = await QueuesService.getQueuesByCompany(companyId) as any[]
        expect(Array.isArray(queues)).toBe(true)
        expect(queues.some((q) => q.id === queueId)).toBe(true)
    })

    it('throws 404 with non-existent companyId', async () => {
        await expect(
            QueuesService.getQueuesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getQueueById ─────────────────────────────────────────────────────────────
describe('QueuesService.getQueueById', () => {
    it('returns queue with member count', async () => {
        const queue = await QueuesService.getQueueById(queueId) as any
        expect(queue.id).toBe(queueId)
        expect(queue._count).toBeDefined()
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            QueuesService.getQueueById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── addMember ────────────────────────────────────────────────────────────────
describe('QueuesService.addMember', () => {
    it('adds extension as member and syncs to asterisk', async () => {
        const member = await QueuesService.addMember(queueId, { extensionId, penalty: 2, paused: false }) as any
        memberId = member.id

        expect(member.extensionId).toBe(extensionId)
        expect(member.penalty).toBe(2)
        expect(member.paused).toBe(false)
        expect(member.extension.number).toBe('9001')

        const astMember = await prisma.queue_members.findFirst({
            where: { interface: 'PJSIP/9001' },
        })
        expect(astMember).not.toBeNull()
        expect(astMember?.penalty).toBe(2)
    })

    it('throws 409 when already a member', async () => {
        await expect(
            QueuesService.addMember(queueId, { extensionId, penalty: 0, paused: false })
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 403 when extension belongs to different company', async () => {
        const otherCompany = await prisma.company.create({ data: { name: 'Other', metadata: {} } })
        const otherExt = await prisma.extension.create({
            data: { alias: 'oth', number: '9999', type: 'pjsip', name: 'Other', companyId: otherCompany.id },
        })

        await expect(
            QueuesService.addMember(queueId, { extensionId: otherExt.id, penalty: 0, paused: false })
        ).rejects.toMatchObject({ statusCode: 403 })

        await prisma.extension.delete({ where: { id: otherExt.id } })
        await prisma.company.delete({ where: { id: otherCompany.id } })
    })

    it('throws 404 with non-existent queue', async () => {
        await expect(
            QueuesService.addMember('clxxxxxxxxxxxxxxxxxxxxxxxxx', { extensionId, penalty: 0, paused: false })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getQueueMembers ──────────────────────────────────────────────────────────
describe('QueuesService.getQueueMembers', () => {
    it('returns list of members', async () => {
        const members = await QueuesService.getQueueMembers(queueId) as any[]
        expect(Array.isArray(members)).toBe(true)
        expect(members.some((m) => m.id === memberId)).toBe(true)
    })

    it('throws 404 with non-existent queue', async () => {
        await expect(
            QueuesService.getQueueMembers('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.updateQueue', () => {
    it('updates queue and syncs to asterisk', async () => {
        const queue = await QueuesService.updateQueue(queueId, { strategy: 'fewestcalls', timeout: 30 }) as any
        expect(queue.strategy).toBe('fewestcalls')
        expect(queue.timeout).toBe(30)

        const astQueue = await prisma.queues.findUnique({ where: { name: `${companyAsteriskId}-suporte` } })
        expect(astQueue?.strategy).toBe('fewestcalls')
        expect(astQueue?.timeout).toBe(30)
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            QueuesService.updateQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx', { timeout: 10 })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateMember ─────────────────────────────────────────────────────────────
describe('QueuesService.updateMember', () => {
    it('updates member and syncs to asterisk', async () => {
        const member = await QueuesService.updateMember(queueId, memberId, { penalty: 10, paused: true }) as any
        expect(member.penalty).toBe(10)
        expect(member.paused).toBe(true)

        const astMember = await prisma.queue_members.findFirst({ where: { interface: 'PJSIP/9001' } })
        expect(astMember?.paused).toBe(1)
        expect(astMember?.penalty).toBe(10)
    })

    it('throws 404 with wrong queueId', async () => {
        await expect(
            QueuesService.updateMember('clxxxxxxxxxxxxxxxxxxxxxxxxx', memberId, { penalty: 1 })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── removeMember ─────────────────────────────────────────────────────────────
describe('QueuesService.removeMember', () => {
    it('removes member and syncs to asterisk', async () => {
        await QueuesService.removeMember(queueId, memberId)

        const check = await prisma.queueMember.findUnique({ where: { id: memberId } })
        expect(check).toBeNull()

        const astCheck = await prisma.queue_members.findFirst({ where: { interface: 'PJSIP/9001' } })
        expect(astCheck).toBeNull()
    })

    it('throws 404 after removal', async () => {
        await expect(
            QueuesService.removeMember(queueId, memberId)
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.deleteQueue', () => {
    it('deletes queue and cleans up asterisk', async () => {
        const tmp = await QueuesService.createQueue({ name: 'tmp-del', companyId }) as any
        const tmpExt = await prisma.extension.create({
            data: { alias: 'tmp', number: '9002', type: 'sip', name: 'Tmp', companyId },
        })
        await QueuesService.addMember(tmp.id, { extensionId: tmpExt.id, penalty: 0, paused: false })

        await QueuesService.deleteQueue(tmp.id)

        const check = await prisma.queue.findUnique({ where: { id: tmp.id } })
        expect(check).toBeNull()

        const astCheck = await prisma.queues.findFirst({ where: { name: { contains: 'tmp-del' } } })
        expect(astCheck).toBeNull()

        const astMemberCheck = await prisma.queue_members.findFirst({ where: { interface: 'SIP/9002' } })
        expect(astMemberCheck).toBeNull()

        await prisma.extension.delete({ where: { id: tmpExt.id } })
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            QueuesService.deleteQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
