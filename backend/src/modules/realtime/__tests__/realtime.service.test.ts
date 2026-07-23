import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

const redisMock = {
    hGetAll: mock((_key: string) => Promise.resolve({} as Record<string, string>)),
    sMembers: mock((_key: string) => Promise.resolve([] as string[])),
    zRangeWithScores: mock((_key: string, _min: number, _max: number) => Promise.resolve([] as { value: string; score: number }[])),
}

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../config/redis', () => ({ redisClient: redisMock }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))

import * as RealtimeService from '../realtime.service'

beforeEach(() => {
    clearPrismaMock(db)
    redisMock.hGetAll.mockReset().mockResolvedValue({})
    redisMock.sMembers.mockReset().mockResolvedValue([])
    redisMock.zRangeWithScores.mockReset().mockResolvedValue([])
})

describe('RealtimeService.getExtensionsStatus', () => {
    const EXTENSION = { id: 'e1', alias: '2002', number: '2002_ast1', name: 'Ramal 2002', type: 'pjsip', companyId: 'c1', company: { asteriskId: 'ast1' } }

    it('returns unknown presence/callState when Redis has no entry', async () => {
        db.extension.findMany.mockResolvedValue([EXTENSION])
        const [ext] = await RealtimeService.getExtensionsStatus(['c1']) as any[]
        expect(ext.presence).toBe('unknown')
        expect(ext.callState).toBe('unknown')
        expect(ext.activeCalls).toEqual([])
    })

    it('maps presence/callState from Redis and lists active calls', async () => {
        db.extension.findMany.mockResolvedValue([EXTENSION])
        redisMock.hGetAll.mockImplementation((key: string) => {
            if (key === 'rt:ext:2002_ast1') return Promise.resolve({ presence: 'online', callState: 'in_call' })
            if (key === 'rt:call:uid-1') return Promise.resolve({ callerNum: '5511999999999', startAt: '1000', bridgedWith: 'uid-2' })
            return Promise.resolve({})
        })
        redisMock.sMembers.mockResolvedValue(['uid-1'])

        const [ext] = await RealtimeService.getExtensionsStatus(['c1']) as any[]
        expect(ext.presence).toBe('online')
        expect(ext.callState).toBe('in_call')
        expect(ext.activeCalls).toEqual([{ uniqueid: 'uid-1', callerNum: '5511999999999', startAt: 1000, bridgedWith: 'uid-2', trunkName: null }])
    })

    it('resolves trunkName from peerChannel when the call came through a trunk', async () => {
        db.extension.findMany.mockResolvedValue([EXTENSION])
        redisMock.hGetAll.mockImplementation((key: string) => {
            if (key === 'rt:call:uid-1')
                return Promise.resolve({
                    callerNum: '5511999999999', startAt: '1000',
                    peerChannel: 'PJSIP/ast1-trunk-VOXDID-TESTE-0000000d',
                })
            return Promise.resolve({})
        })
        redisMock.sMembers.mockResolvedValue(['uid-1'])

        const [ext] = await RealtimeService.getExtensionsStatus(['c1']) as any[]
        expect(ext.activeCalls[0].trunkName).toBe('VOXDID-TESTE')
    })

    it('discards orphan uniqueids whose call hash already expired', async () => {
        db.extension.findMany.mockResolvedValue([EXTENSION])
        redisMock.sMembers.mockResolvedValue(['uid-gone'])
        redisMock.hGetAll.mockResolvedValue({})

        const [ext] = await RealtimeService.getExtensionsStatus(['c1']) as any[]
        expect(ext.activeCalls).toEqual([])
    })

    it('returns empty array for empty companyIds without querying Prisma', async () => {
        const result = await RealtimeService.getExtensionsStatus([])
        expect(result).toEqual([])
        expect(db.extension.findMany).not.toHaveBeenCalled()
    })
})

describe('RealtimeService.getTrunksStatus', () => {
    it('computes the Redis key from the trunk astId and reports presence', async () => {
        db.trunk.findMany.mockResolvedValue([{ id: 't1', name: 'my-trunk', companyId: 'c1', type: 'pjsip', registrationMode: 'outbound' }])
        db.company.findUnique.mockResolvedValue({ id: 'c1', asteriskId: 'ast1' })
        redisMock.hGetAll.mockImplementation((key: string) =>
            key === 'rt:trunk:ast1-trunk-my-trunk' ? Promise.resolve({ presence: 'offline' }) : Promise.resolve({}))

        const [trunk] = await RealtimeService.getTrunksStatus(['c1']) as any[]
        expect(trunk.presence).toBe('offline')
        expect(trunk.expirySeconds).toBeNull()
    })

    it('maps expirySeconds from the outbound registration snapshot', async () => {
        db.trunk.findMany.mockResolvedValue([{ id: 't1', name: 'my-trunk', companyId: 'c1', type: 'pjsip', registrationMode: 'outbound' }])
        db.company.findUnique.mockResolvedValue({ id: 'c1', asteriskId: 'ast1' })
        redisMock.hGetAll.mockImplementation((key: string) =>
            key === 'rt:trunk:ast1-trunk-my-trunk' ? Promise.resolve({ presence: 'online', expirySeconds: '3600' }) : Promise.resolve({}))

        const [trunk] = await RealtimeService.getTrunksStatus(['c1']) as any[]
        expect(trunk.expirySeconds).toBe(3600)
    })

    it('returns empty array when there are no trunks', async () => {
        db.trunk.findMany.mockResolvedValue([])
        const result = await RealtimeService.getTrunksStatus(['c1'])
        expect(result).toEqual([])
    })
})

describe('RealtimeService.getQueuesStatus', () => {
    it('joins queue snapshot, member live status, waiting callers and today\'s holdtime aggregate', async () => {
        db.queue.findMany.mockResolvedValue([{
            id: 'q1', name: 'Vendas', number: '600', companyId: 'c1',
            company: { asteriskId: 'ast1' },
            members: [{ penalty: 0, paused: false, pauseReason: null, extension: { id: 'e1', number: '2002_ast1', name: 'Ramal 2002', type: 'pjsip' } }],
        }])
        redisMock.hGetAll.mockImplementation((key: string) => {
            if (key === 'rt:queue:members:ast1-600') return Promise.resolve({ 'PJSIP/2002_ast1': JSON.stringify({ status: 'idle', paused: false }) })
            if (key === 'rt:call:uid-1') return Promise.resolve({ callerNum: '5511999999999' })
            // Agregado join/leave do dia (handleQueueCallerLeave, ami-events.ts) — sum=50s/2 saídas = média 25s
            if (key.startsWith('rt:queue:holdtime:ast1-600:')) return Promise.resolve({ sum: '50', count: '2' })
            return Promise.resolve({})
        })
        redisMock.zRangeWithScores.mockResolvedValue([{ value: 'uid-1', score: Date.now() - 10_000 }])

        const [queue] = await RealtimeService.getQueuesStatus(['c1']) as any[]
        // calls é ao vivo (tamanho de queueWaitingKey), não o QueueParams.Calls do snapshot periódico
        expect(queue.calls).toBe(1)
        expect(queue.holdtime).toBe(25)
        expect(queue.holdtimeSampleSize).toBe(2)
        expect(queue.members).toEqual([{ extensionId: 'e1', number: '2002_ast1', name: 'Ramal 2002', penalty: 0, paused: false, pauseReason: null, status: 'idle' }])
        expect(queue.waiting).toHaveLength(1)
        expect(queue.waiting[0]).toMatchObject({ uniqueid: 'uid-1', callerNum: '5511999999999' })
        expect(queue.waiting[0].waitingSeconds).toBeGreaterThanOrEqual(9)
    })

    it('reports holdtime 0 with sampleSize 0 when nobody left the queue today', async () => {
        db.queue.findMany.mockResolvedValue([{
            id: 'q1', name: 'Vendas', number: '600', companyId: 'c1',
            company: { asteriskId: 'ast1' },
            members: [],
        }])

        const [queue] = await RealtimeService.getQueuesStatus(['c1']) as any[]
        expect(queue.holdtime).toBe(0)
        expect(queue.holdtimeSampleSize).toBe(0)
    })
})
