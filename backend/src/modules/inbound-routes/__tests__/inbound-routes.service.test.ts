import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/inbound-routes.cache', () => ({
    InboundRoutesCache: {
        getAll: mock(() => null), setAll: mock(), invalidateAll: mock(),
        getByCompany: mock(() => null), setByCompany: mock(),
        getForScope: mock(() => null), setForScope: mock(),
        invalidateByCompany: mock(),
        getRoute: mock(() => null), setRoute: mock(),
        invalidateRoute: mock(),
        invalidateNamespace: mock(),
    },
}))
mock.module('../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { getExtension: mock(() => null), setExtension: mock() },
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: {
        create: mock(() => Promise.resolve()),
        update: mock(() => Promise.resolve()),
        delete: mock(() => Promise.resolve()),
    },
}))

import * as InboundRoutesService from '../inbound-routes.service'

const COMPANY = { id: 'c1', name: 'ACME', asteriskId: 'ast1' }
const DID = { id: 'd1', number: '5511999990001', companyId: 'c1' }
const TRUNK = { id: 't1', name: 'trunk-vivo', companyId: 'c1' }
const EXT = { id: 'e1', companyId: 'c1', context: 'ramais', number: '1001' }
const QUEUE = { id: 'q1', companyId: 'c1', number: '5000' }
const TC = { id: 'tc1', companyId: 'c1' }

const ROUTE = {
    id: 'r1', name: 'entrada-principal', companyId: 'c1',
    didId: 'd1', trunkId: 't1',
    did: DID, trunk: TRUNK, company: { asteriskId: 'ast1' },
    destination: null,
    createdAt: new Date(), updatedAt: new Date(),
}

const BASE_INPUT = {
    name: 'entrada-principal',
    companyId: 'c1',
    didId: 'd1',
    trunkId: 't1',
}

beforeEach(() => clearPrismaMock(db))

// ─── getInboundRoutesByCompany ────────────────────────────────────────────────
describe('InboundRoutesService.getInboundRoutesByCompany', () => {
    it('returns list', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.inboundRoute.findMany.mockResolvedValue([ROUTE])
        db.flowEdge.findMany.mockResolvedValue([])
        const routes = await InboundRoutesService.getInboundRoutesByCompany('c1') as any[]
        expect(routes[0].id).toBe('r1')
    })

    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.getInboundRoutesByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── getInboundRouteById ──────────────────────────────────────────────────────
describe('InboundRoutesService.getInboundRouteById', () => {
    it('returns route by id', async () => {
        db.inboundRoute.findUnique.mockResolvedValue(ROUTE)
        const route = await InboundRoutesService.getInboundRouteById('r1') as any
        expect(route.id).toBe('r1')
    })

    it('throws 404 when not found', async () => {
        db.inboundRoute.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.getInboundRouteById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createInboundRoute ───────────────────────────────────────────────────────
describe('InboundRoutesService.createInboundRoute', () => {
    it('creates with no destination (hangup)', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.inboundRoute.create.mockResolvedValue(ROUTE)
        const route = await InboundRoutesService.createInboundRoute(BASE_INPUT) as any
        expect(route.id).toBe('r1')
    })

    it('creates with extension destination', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(EXT)
        db.inboundRoute.create.mockResolvedValue({ ...ROUTE, destination: { type: 'extension', id: 'e1' } })
        const route = await InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'extension', id: 'e1' },
        }) as any
        expect(route.id).toBe('r1')
    })

    it('creates with queue destination', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.queue.findUnique.mockResolvedValue(QUEUE)
        db.inboundRoute.create.mockResolvedValue(ROUTE)
        await InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'queue', id: 'q1' },
        })
        expect(db.inboundRoute.create).toHaveBeenCalled()
    })

    it('creates with timecondition destination', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.timeCondition.findUnique.mockResolvedValue(TC)
        db.inboundRoute.create.mockResolvedValue(ROUTE)
        await InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'timecondition', id: 'tc1' },
        })
        expect(db.inboundRoute.create).toHaveBeenCalled()
    })

    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when DID not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(null)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when trunk not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when DID belongs to different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue({ ...DID, companyId: 'other' })
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 403 when trunk belongs to different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue({ ...TRUNK, companyId: 'other' })
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 409 when trunk+DID already routed', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findFirst.mockResolvedValue(ROUTE)
        await expect(InboundRoutesService.createInboundRoute(BASE_INPUT))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 when destination extension not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'extension', id: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 403 when destination extension belongs to different company', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.extension.findUnique.mockResolvedValue({ ...EXT, companyId: 'other' })
        await expect(InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'extension', id: 'e1' },
        })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('throws 400 when destination queue has no number', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.queue.findUnique.mockResolvedValue({ ...QUEUE, number: null })
        await expect(InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'queue', id: 'q1' },
        })).rejects.toMatchObject({ statusCode: 400 })
    })

    it('creates route with announcement destination', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.did.findUnique.mockResolvedValue(DID)
        db.trunk.findUnique.mockResolvedValue(TRUNK)
        db.inboundRoute.findUnique.mockResolvedValue(null)
        db.announcement.findUnique.mockResolvedValue({ companyId: 'c1', audioId: 'audio1' })
        db.inboundRoute.create.mockResolvedValue({ ...ROUTE, destination: { type: 'announcement', id: 'ann1' } })
        const route = await InboundRoutesService.createInboundRoute({
            ...BASE_INPUT, destination: { type: 'announcement', id: 'ann1' },
        }) as any
        expect(route.id).toBe('r1')
    })
})

// ─── updateInboundRoute ───────────────────────────────────────────────────────
describe('InboundRoutesService.updateInboundRoute', () => {
    it('updates name', async () => {
        db.inboundRoute.findUnique.mockResolvedValue({ ...ROUTE, did: DID })
        db.inboundRoute.update.mockResolvedValue({ ...ROUTE, name: 'novo-nome' })
        const updated = await InboundRoutesService.updateInboundRoute('r1', { name: 'novo-nome' }) as any
        expect(updated.name).toBe('novo-nome')
    })

    it('updates destination', async () => {
        db.inboundRoute.findUnique.mockResolvedValue({ ...ROUTE, did: DID })
        db.extension.findUnique.mockResolvedValue(EXT)
        db.inboundRoute.update.mockResolvedValue(ROUTE)
        await InboundRoutesService.updateInboundRoute('r1', { destination: { type: 'extension', id: 'e1' } })
        expect(db.inboundRoute.update).toHaveBeenCalled()
    })

    it('throws 404 when not found', async () => {
        db.inboundRoute.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.updateInboundRoute('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'x' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteInboundRoute ───────────────────────────────────────────────────────
describe('InboundRoutesService.deleteInboundRoute', () => {
    it('deletes route', async () => {
        db.inboundRoute.findUnique.mockResolvedValue({ ...ROUTE, did: DID })
        db.inboundRoute.delete.mockResolvedValue(ROUTE)
        await InboundRoutesService.deleteInboundRoute('r1')
        expect(db.inboundRoute.delete).toHaveBeenCalled()
    })

    it('throws 404 when not found', async () => {
        db.inboundRoute.findUnique.mockResolvedValue(null)
        await expect(InboundRoutesService.deleteInboundRoute('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
