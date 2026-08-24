import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))

import * as AuditLogsService from '../audit-logs.service'

const BASE_QUERY = { limit: 50, page: 1, order: 'desc' as const }
const LOG = {
    id: 'a1',
    actorId: 'u1',
    actorName: 'Fulano',
    ip: '1.2.3.4',
    action: 'UPDATE',
    model: 'Trunk',
    recordId: 't1',
    companyId: 'c1',
    before: { name: 'old' },
    after: { name: 'new' },
    createdAt: new Date(),
}

beforeEach(() => clearPrismaMock(db))

describe('AuditLogsService.listAuditLogs', () => {
    it('admin (companyIds null) sees everything without extra where.companyId', async () => {
        db.auditLog.findMany.mockResolvedValue([LOG])
        db.auditLog.count.mockResolvedValue(1)

        const result = await AuditLogsService.listAuditLogs(BASE_QUERY, null)

        expect(result.total).toBe(1)
        expect(db.auditLog.findMany.mock.calls[0][0].where).toEqual({})
    })

    it('scoped user is restricted to companyIds via `in`', async () => {
        db.auditLog.findMany.mockResolvedValue([LOG])
        db.auditLog.count.mockResolvedValue(1)

        await AuditLogsService.listAuditLogs(BASE_QUERY, ['c1', 'c2'])

        expect(db.auditLog.findMany.mock.calls[0][0].where).toEqual({ companyId: { in: ['c1', 'c2'] } })
    })

    it('short-circuits without querying when companyId filter is outside scope', async () => {
        const result = await AuditLogsService.listAuditLogs({ ...BASE_QUERY, companyId: 'other' }, ['c1'])

        expect(result).toEqual({ records: [], total: 0, limit: 50, page: 1 })
        expect(db.auditLog.findMany).not.toHaveBeenCalled()
    })

    it('short-circuits when scope has zero companies', async () => {
        const result = await AuditLogsService.listAuditLogs(BASE_QUERY, [])

        expect(result).toEqual({ records: [], total: 0, limit: 50, page: 1 })
        expect(db.auditLog.findMany).not.toHaveBeenCalled()
    })

    it('applies model/action/actorId filters', async () => {
        db.auditLog.findMany.mockResolvedValue([])
        db.auditLog.count.mockResolvedValue(0)

        await AuditLogsService.listAuditLogs(
            { ...BASE_QUERY, model: 'Trunk', action: 'DELETE', actorId: 'u1' } as any,
            null,
        )

        expect(db.auditLog.findMany.mock.calls[0][0].where).toEqual({
            model: 'Trunk',
            action: 'DELETE',
            actorId: 'u1',
        })
    })
})
