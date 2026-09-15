import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/dids.cache', () => ({
    DidsCache: { getAll: mock(() => null), setAll: mock(), getDid: mock(() => null), setDid: mock(), invalidateDid: mock(), getDidsByCompany: mock(() => null), setDidsByCompany: mock(), invalidateDidsByCompany: mock(), invalidateAll: mock(), invalidateNamespace: mock(), getForScope: mock(() => null), setForScope: mock() },
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: { create: mock(() => Promise.resolve()), update: mock(() => Promise.resolve()), delete: mock(() => Promise.resolve()) },
}))
mock.module('../../inbound-routes/cache/inbound-routes.cache', () => ({
    InboundRoutesCache: { invalidateRoute: mock(() => Promise.resolve()), invalidateByCompany: mock(() => Promise.resolve()), invalidateNamespace: mock(() => Promise.resolve()) },
}))

import * as DidsService from '../dids.service'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const COMPANY2 = { id: 'c2', name: 'Other Co', asteriskId: 'ast2' }
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

    it('throws 409 with duplicate number', async () => {
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

    it('returns usedBy with the inbound route destination when the DID is routed', async () => {
        db.did.findUnique.mockResolvedValue(DID)
        db.inboundRoute.findMany.mockResolvedValue([{ id: 'ir1', name: 'Rota principal', didId: 'd1', companyId: 'c1' }])
        db.flowEdge.findMany.mockResolvedValue([{ sourceType: 'inboundroute', sourceId: 'ir1', slot: 'default', targetType: 'extension', targetId: 'ext1' }])
        const did = await DidsService.getDidById('d1') as any
        expect(did.usedBy).toEqual([{ inboundRouteId: 'ir1', name: 'Rota principal', destination: { type: 'extension', id: 'ext1', label: null } }])
    })

    it('returns empty usedBy when no inbound route references the DID', async () => {
        db.did.findUnique.mockResolvedValue(DID)
        db.inboundRoute.findMany.mockResolvedValue([])
        const did = await DidsService.getDidById('d1') as any
        expect(did.usedBy).toEqual([])
    })
})

// ─── updateDid ────────────────────────────────────────────────────────────────
describe('DidsService.updateDid', () => {
    it('updates DID number', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce(null)
        db.did.update.mockResolvedValue({ ...DID, number: '551100009999' })
        db.inboundRoute.findMany.mockResolvedValue([])
        const did = await DidsService.updateDid('d1', { number: '551100009999' })
        expect(did.number).toBe('551100009999')
    })

    it('regenerates dialplan of existing inbound routes when number changes', async () => {
        const { InboundRouteRepository } = await import('../../../asterisk/inboundroute.repository')
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce(null)
        db.did.update.mockResolvedValue({ ...DID, number: '551100009998' })
        db.inboundRoute.findMany.mockResolvedValue([{ id: 'ir1', trunkId: 't1', trunk: { maxInChannels: 5 } }])
        db.flowEdge.findMany.mockResolvedValue([{ sourceId: 'ir1', slot: 'default', targetType: 'extension', targetId: 'e1' }])
        await DidsService.updateDid('d1', { number: '551100009998' })
        expect(InboundRouteRepository.delete).toHaveBeenCalledWith(expect.anything(), 'ast1', DID.number)
        expect(InboundRouteRepository.create).toHaveBeenCalledWith(expect.anything(), 't1', 'ast1', '551100009998', { type: 'extension', id: 'e1' }, 5)
    })

    it('does not touch dialplan when routing key is unchanged', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce(null)
        db.did.update.mockResolvedValue(DID)
        const did = await DidsService.updateDid('d1', { number: DID.number })
        expect(did.number).toBe(DID.number)
        expect(db.inboundRoute.findMany).not.toHaveBeenCalled()
    })

    it('throws 409 when number already exists', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce({ id: 'd2', number: '551100002222', companyId: 'c1' })
        await expect(DidsService.updateDid('d1', { number: '551100002222' }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 with non-existent id', async () => {
        db.did.findUnique.mockResolvedValue(null)
        await expect(DidsService.updateDid('clxxxxxxxxxxxxxxxxxxxxxxxxx', { number: '123' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('reassigns DID to another company and wipes old inbound routes/dialplan', async () => {
        const { InboundRouteRepository } = await import('../../../asterisk/inboundroute.repository')
        db.did.findUnique.mockResolvedValueOnce(DID).mockResolvedValueOnce(null)
        db.company.findUnique.mockImplementation((args: any) =>
            Promise.resolve(args.where.id === 'c2' ? COMPANY2 : COMPANY)
        )
        db.inboundRoute.findMany.mockResolvedValue([{ id: 'ir1', trunkId: 't1' }])
        db.did.update.mockResolvedValue({ ...DID, companyId: 'c2' })

        const did = await DidsService.updateDid('d1', { companyId: 'c2' }) as any

        expect(did.companyId).toBe('c2')
        expect(InboundRouteRepository.delete).toHaveBeenCalledWith(expect.anything(), 'ast1', DID.number)
        expect(db.inboundRoute.deleteMany).toHaveBeenCalledWith({ where: { didId: 'd1' } })
        expect(db.flowEdge.deleteMany).toHaveBeenCalledWith({ where: { sourceType: 'inboundroute', sourceId: { in: ['ir1'] } } })
    })

    it('throws 404 when target company does not exist', async () => {
        db.did.findUnique.mockResolvedValueOnce(DID)
        db.company.findUnique.mockResolvedValue(null)
        await expect(DidsService.updateDid('d1', { companyId: 'c2' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteDid ────────────────────────────────────────────────────────────────
describe('DidsService.deleteDid', () => {
    it('deletes DID', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
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
