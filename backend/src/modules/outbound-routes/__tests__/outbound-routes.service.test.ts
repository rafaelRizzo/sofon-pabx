import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompany: mock(() => null), setCompany: mock() },
}))
mock.module('../cache/outbound-routes.cache', () => ({
    OutboundRoutesCache: {
        getByCompany: mock(() => null), setByCompany: mock(),
        getRoute: mock(() => null), setRoute: mock(),
        invalidateRoute: mock(), invalidateByCompany: mock(), invalidateNamespace: mock(),
    },
}))

import * as Service from '../outbound-routes.service'

const COMPANY = { id: 'c1', asteriskId: 'ast1' }
const TRUNK = { id: 't1', name: 'tst-trunk', companyId: 'c1', registrationMode: 'outbound' }
const EXT = { id: 'e1', alias: '2001', number: '2001_ast1', type: 'pjsip', name: 'Test', context: 'ramais', companyId: 'c1' }
const ROUTE = {
    id: 'r1', name: 'Saídas', companyId: 'c1', position: 1,
    company: { asteriskId: 'ast1' },
    patterns: [], trunks: [], extensions: [],
    createdAt: new Date(), updatedAt: new Date(),
}
const PATTERN = { id: 'p1', outboundRouteId: 'r1', pattern: '_0XXXXXXXX', prefix: null, prepend: null, position: 1 }

beforeEach(() => clearPrismaMock(db))

// ─── getOutboundRouteById ─────────────────────────────────────────────────────
describe('Service.getOutboundRouteById', () => {
    it('throws 404 with non-existent id', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.getOutboundRouteById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createOutboundRoute ──────────────────────────────────────────────────────
describe('Service.createOutboundRoute', () => {
    it('throws 404 when company not found', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(Service.createOutboundRoute({
            name: 'X', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
            position: 0, trunkIds: ['t1'], patterns: [{ pattern: '_X.', position: 0 }],
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when trunk not found', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.outboundRoute.findMany.mockResolvedValue([])
        db.trunk.findMany.mockResolvedValue([])
        await expect(Service.createOutboundRoute({
            name: 'X', companyId: 'c1',
            position: 0, trunkIds: ['clxxxxxxxxxxxxxxxxxxxxxxxxx'], patterns: [{ pattern: '_X.', position: 0 }],
        }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('creates route and returns with patterns and trunks', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        db.outboundRoute.findMany.mockResolvedValue([])
        db.trunk.findMany.mockResolvedValue([TRUNK])
        db.outboundRoute.create.mockResolvedValue({ ...ROUTE, trunks: [{ trunk: TRUNK }] })
        db.outboundDialPattern.create.mockResolvedValue(PATTERN)
        db.outboundRouteTrunk.create.mockResolvedValue({})
        db.extensions.deleteMany.mockResolvedValue({ count: 0 })
        db.extensions.createMany.mockResolvedValue({ count: 1 })
        db.outboundRoute.findUnique.mockResolvedValue(ROUTE)

        const route = await Service.createOutboundRoute({
            name: 'Saídas',
            companyId: 'c1',
            position: 0,
            trunkIds: ['t1'],
            patterns: [{ pattern: '_0XXXXXXXX', prefix: null, prepend: null, position: 0 }],
        }) as any
        expect(route).toBeDefined()
    })
})

// ─── updateOutboundRoute ──────────────────────────────────────────────────────
describe('Service.updateOutboundRoute', () => {
    it('throws 404 with non-existent id', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.updateOutboundRoute('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteOutboundRoute ──────────────────────────────────────────────────────
describe('Service.deleteOutboundRoute', () => {
    it('throws 404 with non-existent id', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.deleteOutboundRoute('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── addPattern ───────────────────────────────────────────────────────────────
describe('Service.addPattern', () => {
    it('throws 404 when route not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.addPattern('clxxxxxxxxxxxxxxxxxxxxxxxxx', { pattern: '_0XXXXXXXX', position: 0 }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── updatePattern ────────────────────────────────────────────────────────────
describe('Service.updatePattern', () => {
    it('throws 404 when pattern not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(ROUTE)
        db.outboundDialPattern.findUnique.mockResolvedValue(null)
        await expect(Service.updatePattern('r1', 'clxxxxxxxxxxxxxxxxxxxxxxxxx', { pattern: '_X.' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── setTrunks ────────────────────────────────────────────────────────────────
describe('Service.setTrunks', () => {
    it('throws 404 when route not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.setTrunks('clxxxxxxxxxxxxxxxxxxxxxxxxx', { trunkIds: ['t1'] }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when trunk not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(ROUTE)
        db.trunk.findMany.mockResolvedValue([])
        await expect(Service.setTrunks('r1', { trunkIds: ['clxxxxxxxxxxxxxxxxxxxxxxxxx'] }))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── addExtension ─────────────────────────────────────────────────────────────
describe('Service.addExtension', () => {
    it('throws 404 when route not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(null)
        await expect(Service.addExtension('clxxxxxxxxxxxxxxxxxxxxxxxxx', 'e1'))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('throws 404 when extension not found', async () => {
        db.outboundRoute.findUnique.mockResolvedValue(ROUTE)
        db.extension.findUnique.mockResolvedValue(null)
        await expect(Service.addExtension('r1', 'clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
