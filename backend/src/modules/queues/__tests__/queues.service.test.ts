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
mock.module('../cache/queues.cache', () => ({
    QueuesCache: {
        getAll: mock(() => null),
        setAll: mock(),
        getByCompany: mock(() => null),
        setByCompany: mock(),
        getForScope: mock(() => null),
        setForScope: mock(),
        getQueue: mock(() => null),
        setQueue: mock(),
        invalidateQueue: mock(),
        invalidateByCompany: mock(),
        invalidateNamespace: mock(),
        invalidateAll: mock()
    }
}))
mock.module('../../queue-members/cache/queue-members.cache', () => ({
    QueueMembersCache: {
        getMembers: mock(() => null),
        setMembers: mock(),
        invalidateMembers: mock(),
        invalidateNamespace: mock()
    }
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
        regenerate: mock(() => Promise.resolve())
    },
    toAsteriskQueueName: (asteriskId: string, queueName: string) =>
        `${asteriskId}-${queueName}`
}))
mock.module('../../../asterisk/callcenter-survey.repository', () => ({
    CallcenterSurveyRepository: {
        regenerate: mock(() => Promise.resolve())
    }
}))

import * as QueuesService from '../queues.service'
import { CallcenterSurveyRepository } from '../../../asterisk/callcenter-survey.repository'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const QUEUE = {
    id: 'q1',
    name: 'suporte',
    number: null,
    companyId: 'c1',
    strategy: 'ringall',
    musicOnHold: 'default',
    mohAudioId: null,
    timeout: 15,
    retry: 5,
    maxLen: 0,
    wrapupTime: 0,
    announce: null,
    announceFrequency: 0,
    joinEmpty: true,
    leaveWhenEmpty: false,
    weight: 0,
    metadata: {},
    surveyAudioId: null,
    surveyServiceAudioId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    company: { asteriskId: 'ast1' },
    _count: { members: 0 }
}

beforeEach(() => {
    clearPrismaMock(db)
    ;(CallcenterSurveyRepository.regenerate as any).mockClear()
})

// ─── createQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.createQueue', () => {
    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(
            QueuesService.createQueue({
                name: 'test',
                companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
                number: '8000',
                strategy: 'ringall',
                timeout: 15,
                retry: 5,
                maxLen: 0,
                wrapupTime: 0,
                announceFrequency: 0,
                announcePosition: false,
                periodicAnnounceFrequency: 60,
                joinEmpty: true,
                leaveWhenEmpty: false,
                weight: 0,
                callcenterEnabled: false
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 409 with duplicate name in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique.mockResolvedValue(QUEUE)
        await expect(
            QueuesService.createQueue({
                name: 'suporte',
                companyId: 'c1',
                number: '8001',
                strategy: 'ringall',
                timeout: 15,
                retry: 5,
                maxLen: 0,
                wrapupTime: 0,
                announceFrequency: 0,
                announcePosition: false,
                periodicAnnounceFrequency: 60,
                joinEmpty: true,
                leaveWhenEmpty: false,
                weight: 0,
                callcenterEnabled: false
            })
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('creates queue with defaults', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        db.queue.create.mockResolvedValue(QUEUE)

        const queue = (await QueuesService.createQueue({
            name: 'suporte',
            companyId: 'c1',
            number: '8001'
        } as any)) as any
        expect(queue.name).toBe('suporte')
        expect(queue.strategy).toBe('ringall')
    })

    it('throws 409 with duplicate number in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(QUEUE)
        await expect(
            QueuesService.createQueue({
                name: 'suporte2',
                companyId: 'c1',
                number: '8001'
            } as any)
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('syncs dialplan with postQueueDestination', async () => {
        const { AsteriskQueueRepository } =
            await import('../../../asterisk/queue.repository')
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        db.queue.create.mockResolvedValue(QUEUE)
        await QueuesService.createQueue({
            name: 'suporte',
            companyId: 'c1',
            number: '8001',
            postQueueDestination: { type: 'hangup' }
        } as any)
        expect(AsteriskQueueRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 400 when only surveyAudioId is provided', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        await expect(
            QueuesService.createQueue({
                name: 'suporte',
                companyId: 'c1',
                number: '8001',
                surveyAudioId: 'aud1'
            } as any)
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 400 when only surveyServiceAudioId is provided', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        await expect(
            QueuesService.createQueue({
                name: 'suporte',
                companyId: 'c1',
                number: '8001',
                surveyServiceAudioId: 'aud2'
            } as any)
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('creates queue and regenerates survey dialplan when both survey audios are provided', async () => {
        const { CallcenterSurveyRepository } =
            await import('../../../asterisk/callcenter-survey.repository')
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.queue.create.mockResolvedValue({
            ...QUEUE,
            surveyAudioId: 'aud1',
            surveyServiceAudioId: 'aud2'
        })

        await QueuesService.createQueue({
            name: 'suporte',
            companyId: 'c1',
            number: '8001',
            surveyAudioId: 'aud1',
            surveyServiceAudioId: 'aud2'
        } as any)

        expect(CallcenterSurveyRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('does not regenerate survey dialplan when neither survey audio is provided', async () => {
        const { CallcenterSurveyRepository } =
            await import('../../../asterisk/callcenter-survey.repository')
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
        db.queue.create.mockResolvedValue(QUEUE)

        await QueuesService.createQueue({
            name: 'suporte',
            companyId: 'c1',
            number: '8001'
        } as any)

        expect(CallcenterSurveyRepository.regenerate).not.toHaveBeenCalled()
    })
})

// ─── getQueuesByCompany ───────────────────────────────────────────────────────
describe('QueuesService.getQueuesByCompany', () => {
    it('returns list of queues', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.queue.findMany.mockResolvedValue([QUEUE])
        db.flowEdge.findMany.mockResolvedValue([])
        const queues = (await QueuesService.getQueuesByCompany('c1')) as any[]
        expect(Array.isArray(queues)).toBe(true)
        expect(queues[0].id).toBe('q1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(
            QueuesService.getQueuesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getQueueById ─────────────────────────────────────────────────────────────
describe('QueuesService.getQueueById', () => {
    it('returns queue', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        const queue = (await QueuesService.getQueueById('q1')) as any
        expect(queue.id).toBe('q1')
    })

    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(
            QueuesService.getQueueById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.updateQueue', () => {
    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(
            QueuesService.updateQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx', {
                timeout: 10
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates queue', async () => {
        db.queue.findUnique
            .mockResolvedValueOnce(QUEUE)
            .mockResolvedValueOnce({ ...QUEUE, timeout: 30 })
        db.queue.update.mockResolvedValue({ ...QUEUE, timeout: 30 })
        db.flowEdge.findMany.mockResolvedValue([])
        const queue = (await QueuesService.updateQueue('q1', {
            timeout: 30
        })) as any
        expect(queue.timeout).toBe(30)
    })

    it('resyncs dialplan when only postQueueDestination changes', async () => {
        const { AsteriskQueueRepository } =
            await import('../../../asterisk/queue.repository')
        const existing = { ...QUEUE, number: '8000' }
        db.queue.findUnique.mockResolvedValueOnce(existing)
        db.queue.update.mockResolvedValue({
            ...existing,
            postQueueDestination: { type: 'hangup' }
        })
        db.flowEdge.findMany.mockResolvedValue([])
        await QueuesService.updateQueue('q1', {
            postQueueDestination: { type: 'hangup' }
        })
        expect(AsteriskQueueRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('allows setting the missing survey audio when the other already exists', async () => {
        const existing = { ...QUEUE, surveyAudioId: 'aud1', surveyServiceAudioId: null }
        db.queue.findUnique.mockResolvedValueOnce(existing)
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })
        db.queue.update.mockResolvedValue({
            ...existing,
            surveyServiceAudioId: 'aud2'
        })
        db.flowEdge.findMany.mockResolvedValue([])

        await QueuesService.updateQueue('q1', {
            surveyServiceAudioId: 'aud2'
        } as any)

        expect(CallcenterSurveyRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('throws 400 when unsetting one survey audio leaves the other alone', async () => {
        const existing = { ...QUEUE, surveyAudioId: 'aud1', surveyServiceAudioId: 'aud2' }
        db.queue.findUnique.mockResolvedValueOnce(existing)

        await expect(
            QueuesService.updateQueue('q1', { surveyAudioId: null } as any)
        ).rejects.toMatchObject({ statusCode: 400 })
        expect(db.queue.update).not.toHaveBeenCalled()
    })

    it('throws 400 when setting only one survey audio on a queue that has none', async () => {
        db.queue.findUnique.mockResolvedValueOnce(QUEUE)
        db.audio.findUnique.mockResolvedValue({ companyId: 'c1' })

        await expect(
            QueuesService.updateQueue('q1', { surveyAudioId: 'aud1' } as any)
        ).rejects.toMatchObject({ statusCode: 400 })
        expect(db.queue.update).not.toHaveBeenCalled()
    })
})

// ─── deleteQueue ──────────────────────────────────────────────────────────────
describe('QueuesService.deleteQueue', () => {
    it('throws 404 with non-existent id', async () => {
        db.queue.findUnique.mockResolvedValue(null)
        await expect(
            QueuesService.deleteQueue('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('deletes queue when not referenced', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([]) // ninguém referencia - assertNotReferenced passa
        await QueuesService.deleteQueue('q1')
        expect(db.queue.delete).toHaveBeenCalledWith({ where: { id: 'q1' } })
    })

    it('throws 409 when still referenced by another flow', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([
            { sourceType: 'timecondition', sourceId: 'tc1', slot: 'true' }
        ])
        await expect(QueuesService.deleteQueue('q1')).rejects.toMatchObject({
            statusCode: 409
        })
        expect(db.queue.delete).not.toHaveBeenCalled()
    })

    it('regenerates survey dialplan when only surveyAudioId was set', async () => {
        db.queue.findUnique.mockResolvedValue({
            ...QUEUE,
            surveyAudioId: 'aud1',
            surveyServiceAudioId: null
        })
        db.flowEdge.findMany.mockResolvedValue([])
        await QueuesService.deleteQueue('q1')
        expect(CallcenterSurveyRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('regenerates survey dialplan when only surveyServiceAudioId was set', async () => {
        db.queue.findUnique.mockResolvedValue({
            ...QUEUE,
            surveyAudioId: null,
            surveyServiceAudioId: 'aud2'
        })
        db.flowEdge.findMany.mockResolvedValue([])
        await QueuesService.deleteQueue('q1')
        expect(CallcenterSurveyRepository.regenerate).toHaveBeenCalledWith('c1')
    })

    it('does not regenerate survey dialplan when neither survey audio was set', async () => {
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.flowEdge.findMany.mockResolvedValue([])
        await QueuesService.deleteQueue('q1')
        expect(CallcenterSurveyRepository.regenerate).not.toHaveBeenCalled()
    })
})
