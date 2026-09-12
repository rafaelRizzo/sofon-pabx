import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../../lib/prisma', () => ({ prisma: db }))

const updateMemberMock = mock(() => Promise.resolve())
mock.module('../../../queue-members/queue-members.service', () => ({
    updateMember: updateMemberMock,
}))

import * as AgentStatusService from '../agent-status.service'

const USER = { extensionId: 'e1' }
const EXTENSION = { id: 'e1', companyId: 'c1' }
const REASON = { id: 'pr1', companyId: 'c1', label: 'Almoço', active: true }
const MEMBER_Q1 = { id: 'm1', queueId: 'q1', paused: false, pauseReason: null, queue: { id: 'q1', name: 'suporte', number: '600' } }
const MEMBER_Q2 = { id: 'm2', queueId: 'q2', paused: false, pauseReason: null, queue: { id: 'q2', name: 'vendas', number: '601' } }

beforeEach(() => {
    clearPrismaMock(db)
    updateMemberMock.mockClear()
})

describe('AgentStatusService.getMyStatus', () => {
    it('throws 404 when user has no extension linked', async () => {
        db.user.findUnique.mockResolvedValue({ extensionId: null })
        await expect(AgentStatusService.getMyStatus('u1')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when extension does not exist', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(AgentStatusService.getMyStatus('u1')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('reports available when no queue is paused', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.queueMember.findMany.mockResolvedValue([MEMBER_Q1, MEMBER_Q2])
        db.pauseReason.findMany.mockResolvedValue([{ id: 'pr1', label: 'Almoço' }])

        const status = await AgentStatusService.getMyStatus('u1')
        expect(status.paused).toBe(false)
        expect(status.queues).toHaveLength(2)
        expect(status.availableReasons).toEqual([{ id: 'pr1', label: 'Almoço' }])
    })

    it('reports paused only when every membership is paused', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.queueMember.findMany.mockResolvedValue([
            { ...MEMBER_Q1, paused: true, pauseReason: 'Almoço' },
            MEMBER_Q2,
        ])
        db.pauseReason.findMany.mockResolvedValue([REASON])

        const status = await AgentStatusService.getMyStatus('u1')
        expect(status.paused).toBe(false)
    })

    it('reports paused when all memberships are paused', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.queueMember.findMany.mockResolvedValue([
            { ...MEMBER_Q1, paused: true, pauseReason: 'Almoço' },
            { ...MEMBER_Q2, paused: true, pauseReason: 'Almoço' },
        ])
        db.pauseReason.findMany.mockResolvedValue([REASON])

        const status = await AgentStatusService.getMyStatus('u1')
        expect(status.paused).toBe(true)
        expect(status.pauseReason).toBe('Almoço')
    })
})

describe('AgentStatusService.setMyStatus', () => {
    it('throws 400 when pausing without a reason', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        await expect(AgentStatusService.setMyStatus('u1', { paused: true }))
            .rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 400 when reason belongs to another company', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.pauseReason.findUnique.mockResolvedValue({ ...REASON, companyId: 'other' })
        await expect(AgentStatusService.setMyStatus('u1', { paused: true, pauseReasonId: 'pr1' }))
            .rejects.toMatchObject({ statusCode: 400 })
    })

    it('pauses every queue membership with the resolved reason label', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.pauseReason.findUnique.mockResolvedValue(REASON)
        db.queueMember.findMany
            .mockResolvedValueOnce([{ id: 'm1', queueId: 'q1' }, { id: 'm2', queueId: 'q2' }])
            .mockResolvedValueOnce([
                { ...MEMBER_Q1, paused: true, pauseReason: 'Almoço' },
                { ...MEMBER_Q2, paused: true, pauseReason: 'Almoço' },
            ])
        db.pauseReason.findMany.mockResolvedValue([REASON])

        const status = await AgentStatusService.setMyStatus('u1', { paused: true, pauseReasonId: 'pr1' })

        expect(updateMemberMock).toHaveBeenCalledTimes(2)
        expect(updateMemberMock).toHaveBeenCalledWith('q1', 'm1', { paused: true, pauseReason: 'Almoço' })
        expect(updateMemberMock).toHaveBeenCalledWith('q2', 'm2', { paused: true, pauseReason: 'Almoço' })
        expect(status.paused).toBe(true)
    })

    it('clears the reason when resuming', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.extension.findUnique.mockResolvedValue(EXTENSION)
        db.queueMember.findMany
            .mockResolvedValueOnce([{ id: 'm1', queueId: 'q1' }])
            .mockResolvedValueOnce([MEMBER_Q1])
        db.pauseReason.findMany.mockResolvedValue([REASON])

        await AgentStatusService.setMyStatus('u1', { paused: false })

        expect(updateMemberMock).toHaveBeenCalledWith('q1', 'm1', { paused: false, pauseReason: null })
    })
})
