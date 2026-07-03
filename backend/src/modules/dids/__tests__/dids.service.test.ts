import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/dids.cache', () => ({
    DidsCache: { getAll: mock(() => null), setAll: mock(), getDid: mock(() => null), setDid: mock(), invalidateDid: mock(), getDidsByCompany: mock(() => null), setDidsByCompany: mock(), invalidateDidsByCompany: mock(), invalidateAll: mock() },
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: { create: mock(() => Promise.resolve()), update: mock(() => Promise.resolve()), delete: mock(() => Promise.resolve()) },
}))
mock.module('../../inbound-routes/cache/inbound-routes.cache', () => ({
    InboundRoutesCache: { invalidateRoute: mock(() => Promise.resolve()), invalidateByCompany: mock(() => Promise.resolve()) },
}))

import * as DidsService from '../dids.service'

const COMPANY = { id: 'c1', name: 'ACME' }
const DID = { id: 'd1', number: '551100001111', companyId: 'c1', createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── createDid ────────────────────────────────────────────────────────────────
describe('DidsService.createDid', () => {
    it('creates DID', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(null)
        db.did.create.mockResolvedValue(DID)
        const did = await DidsService.createDid({ number: '551100001111', companyId: 'c1' })
        expect(did.number).toBe('551100001111')
    })

    it('throws 409 with duplicate number in same company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        await expect(DidsService.createDid({ number: '551100001111', companyId: 'c1' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(DidsService.createDid({ number: '999', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getDidsByCompany ─────────────────────────────────────────────────────────
describe('DidsService.getDidsByCompany', () => {
    it('returns DIDs from company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findMany.mockResolvedValue([DID])
        const dids = await DidsService.getDidsByCompany('c1') as any[]
        expect(dids[0].id).toBe('d1')
    })

    it('throws 404 with non-existent companyId', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(DidsService.getDidsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getDidById ───────────────────────────────────────────────────────────────
describe('DidsService.getDidById', () => {
    it('returns DID by id', async () => {
        db.did.findUnique.mockResolvedValue(DID)
        const did = await DidsService.getDidById('d1') as any
        expect(did.id).toBe('d1')
    })

    it('throws 404 with non-existent id', async () => {
        db.did.findUnique.mockResolvedValue(null)
        await expect(DidsService.getDidById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updateDid ────────────────────────────────────────────────────────────────
describe('DidsService.updateDid', () => {
    it('updates DID number', async () => {
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce(null)
        db.did.update.mockResolvedValue({ ...DID, number: '551100009999' })
        const did = await DidsService.updateDid('d1', { number: '551100009999' })
        expect(did.number).toBe('551100009999')
    })

    it('throws 409 when number already exists in same company', async () => {
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce({ id: 'd2', number: '551100002222', companyId: 'c1' })
        await expect(DidsService.updateDid('d1', { number: '551100002222' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent id', async () => {
        db.did.findUnique.mockResolvedValue(null)
        await expect(DidsService.updateDid('clxxxxxxxxxxxxxxxxxxxxxxxxx', { number: '123' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteDid ────────────────────────────────────────────────────────────────
describe('DidsService.deleteDid', () => {
    it('deletes DID', async () => {
        db.did.findUnique.mockResolvedValue(DID)
        db.did.delete.mockResolvedValue(DID)
        db.inboundRoute.findMany.mockResolvedValue([])
        await DidsService.deleteDid('d1')
        expect(db.did.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
    })

    it('throws 404 with non-existent id', async () => {
        db.did.findUnique.mockResolvedValue(null)
        await expect(DidsService.deleteDid('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
