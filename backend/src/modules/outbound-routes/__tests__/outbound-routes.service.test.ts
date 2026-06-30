import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as Service from '../outbound-routes.service'

const PREFIX = `__test_ob_routes_${Date.now()}__`

let companyId: string
let asteriskId: string
let trunkId: string
let routeId: string
let extensionId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: { name: 'Test', username: `${PREFIX}@test.com`, password: 'x', role: 'admin' },
    })

    const company = await prisma.company.create({
        data: { name: `${PREFIX} Co`, metadata: {}, users: { create: { userId: user.id } } },
    })
    companyId = company.id
    asteriskId = company.asteriskId

    const trunk = await prisma.trunk.create({
        data: {
            name: 'tst-trunk',
            companyId,
            registrationMode: 'outbound',
            host: 'sip.test.com',
            username: 'user',
            password: 'pass',
        },
    })
    trunkId = trunk.id

    const ext = await prisma.extension.create({
        data: {
            alias: '9001',
            number: `9001_${asteriskId}`,
            type: 'pjsip',
            name: 'Test Ext',
            context: 'ramais',
            companyId,
        },
    })
    extensionId = ext.id
})

afterAll(async () => {
    await prisma.extensions.deleteMany({ where: { context: 'ramais', exten: { startsWith: '_' } } }).catch(() => {})
    await prisma.outboundRoute.deleteMany({ where: { companyId } }).catch(() => {})
    await prisma.extension.deleteMany({ where: { companyId } }).catch(() => {})
    await prisma.trunk.deleteMany({ where: { companyId } }).catch(() => {})
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {})
    await teardownTestEnv(PREFIX)
})

// ─── createOutboundRoute ──────────────────────────────────────────────────────
describe('Service.createOutboundRoute', () => {
    it('creates route with pattern + trunk and writes dialplan', async () => {
        const route = await Service.createOutboundRoute({
            name: 'Saídas Nacionais',
            companyId,
            position: 1,
            trunkIds: [trunkId],
            patterns: [{ pattern: '_0[1-9][2-8]XXXXXXXX', prefix: '0', prepend: null, position: 1 }],
        })

        routeId = route.id
        expect(route.name).toBe('Saídas Nacionais')
        expect(route.patterns).toHaveLength(1)
        expect(route.trunks).toHaveLength(1)
        expect(route.extensions).toHaveLength(0)

        const dialplan = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0[1-9][2-8]XXXXXXXX' },
            orderBy: { priority: 'asc' },
        })
        expect(dialplan.length).toBeGreaterThanOrEqual(2)
        expect(dialplan[0]?.app).toBe('Set')
        expect(dialplan[0]?.appdata).toContain('EXTEN:1')
        const mixMonitor = dialplan.find((e) => e.app === 'MixMonitor')
        expect(mixMonitor).toBeDefined()
        expect(mixMonitor?.appdata).toContain(asteriskId)
        const dial = dialplan.find((e) => e.app === 'Dial')
        expect(dial?.appdata).toContain(`${asteriskId}-trunk-tst-trunk`)
        expect(dial?.appdata).toContain('@')
    })

    it('throws 404 with unknown trunk', async () => {
        await expect(
            Service.createOutboundRoute({
                name: 'Bad',
                companyId,
                position: 2,
                trunkIds: ['nonexistentcuid000000000'],
                patterns: [{ pattern: '_X.', prefix: null, prepend: null, position: 1 }],
            }),
        ).rejects.toThrow('not found')
    })

    it('throws 404 with unknown company', async () => {
        await expect(
            Service.createOutboundRoute({
                name: 'Bad',
                companyId: 'nonexistentcuid000000000',
                position: 1,
                trunkIds: [trunkId],
                patterns: [{ pattern: '_X.', prefix: null, prepend: null, position: 1 }],
            }),
        ).rejects.toThrow('Company not found')
    })
})

// ─── getOutboundRoutes ────────────────────────────────────────────────────────
describe('Service.getOutboundRoutes', () => {
    it('lists routes for company', async () => {
        const routes = await Service.getOutboundRoutes(companyId)
        expect(routes.length).toBeGreaterThanOrEqual(1)
        expect(routes.every((r: any) => r.companyId === companyId)).toBe(true)
    })

    it('returns empty array for unknown company', async () => {
        const routes = await Service.getOutboundRoutes('nonexistentcuid000000000')
        expect(routes).toHaveLength(0)
    })
})

// ─── getOutboundRouteById ─────────────────────────────────────────────────────
describe('Service.getOutboundRouteById', () => {
    it('returns route with all relations', async () => {
        const route = await Service.getOutboundRouteById(routeId)
        expect(route.id).toBe(routeId)
        expect(route.patterns).toHaveLength(1)
        expect(route.trunks).toHaveLength(1)
        expect(Array.isArray(route.extensions)).toBe(true)
    })

    it('throws 404 for unknown id', async () => {
        await expect(Service.getOutboundRouteById('nonexistentcuid000000000')).rejects.toThrow('not found')
    })
})

// ─── updateOutboundRoute ──────────────────────────────────────────────────────
describe('Service.updateOutboundRoute', () => {
    it('updates name only', async () => {
        const updated = await Service.updateOutboundRoute(routeId, { name: 'Novo Nome' })
        expect(updated.name).toBe('Novo Nome')
        expect(updated.patterns).toHaveLength(1)
    })

    it('replaces patterns and rewrites dialplan', async () => {
        await Service.updateOutboundRoute(routeId, {
            patterns: [{ pattern: '_55ZX9XXXXXXXX', prefix: null, prepend: null, position: 1 }],
        })

        const old = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0[1-9][2-8]XXXXXXXX' },
        })
        expect(old).toHaveLength(0)

        const newDp = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_55ZX9XXXXXXXX' },
            orderBy: { priority: 'asc' },
        })
        expect(newDp.length).toBeGreaterThanOrEqual(2)
        const dial = newDp.find((e) => e.app === 'Dial')
        expect(dial?.appdata).toContain('${EXTEN}@')
    })

    it('throws 404 for unknown id', async () => {
        await expect(
            Service.updateOutboundRoute('nonexistentcuid000000000', { name: 'x' }),
        ).rejects.toThrow('not found')
    })
})

// ─── addPattern / updatePattern / deletePattern ───────────────────────────────
describe('Service.addPattern / updatePattern / deletePattern', () => {
    let patternId: string

    it('adds pattern and writes dialplan', async () => {
        const pattern = await Service.addPattern(routeId, {
            pattern: '_0800XXXXXXX',
            prefix: null,
            prepend: null,
            position: 2,
        })
        expect(pattern?.pattern).toBe('_0800XXXXXXX')
        patternId = pattern!.id

        const dialplan = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0800XXXXXXX' },
        })
        expect(dialplan.length).toBeGreaterThanOrEqual(2)
    })

    it('throws 404 adding pattern to unknown route', async () => {
        await expect(
            Service.addPattern('nonexistentcuid000000000', {
                pattern: '_X.',
                prefix: null,
                prepend: null,
                position: 1,
            }),
        ).rejects.toThrow('not found')
    })

    it('updates pattern and rewrites dialplan', async () => {
        await Service.updatePattern(routeId, patternId, { pattern: '_0800YYYYYYY' })

        const old = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0800XXXXXXX' },
        })
        expect(old).toHaveLength(0)

        const newDp = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0800YYYYYYY' },
        })
        expect(newDp.length).toBeGreaterThanOrEqual(2)
    })

    it('throws 404 updating unknown pattern', async () => {
        await expect(
            Service.updatePattern(routeId, 'nonexistentcuid000000000', { pattern: '_X.' }),
        ).rejects.toThrow('not found')
    })

    it('deletes pattern and removes dialplan', async () => {
        await Service.deletePattern(routeId, patternId)

        const after = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_0800YYYYYYY' },
        })
        expect(after).toHaveLength(0)

        await expect(
            Service.updatePattern(routeId, patternId, { pattern: '_X.' }),
        ).rejects.toThrow('not found')
    })

    it('throws 404 deleting unknown pattern', async () => {
        await expect(
            Service.deletePattern(routeId, 'nonexistentcuid000000000'),
        ).rejects.toThrow('not found')
    })
})

// ─── setTrunks ────────────────────────────────────────────────────────────────
describe('Service.setTrunks', () => {
    it('replaces trunks and rewrites dialplan with failover', async () => {
        const trunk2 = await prisma.trunk.create({
            data: { name: 'tst-trunk-2', companyId, registrationMode: 'inbound' },
        })

        await Service.setTrunks(routeId, { trunkIds: [trunkId, trunk2.id] })

        const route = await Service.getOutboundRouteById(routeId)
        expect(route.trunks).toHaveLength(2)

        const dialplan = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_55ZX9XXXXXXXX' },
            orderBy: { priority: 'asc' },
        })
        const dials = dialplan.filter((e) => e.app === 'Dial')
        expect(dials).toHaveLength(2)
        expect(dials[0]?.appdata).toContain('tst-trunk')
        expect(dials[1]?.appdata).toContain('tst-trunk-2')
    })

    it('throws 404 with unknown trunk', async () => {
        await expect(
            Service.setTrunks(routeId, { trunkIds: ['nonexistentcuid000000000'] }),
        ).rejects.toThrow('not found')
    })

    it('throws 404 for unknown route', async () => {
        await expect(
            Service.setTrunks('nonexistentcuid000000000', { trunkIds: [trunkId] }),
        ).rejects.toThrow('not found')
    })
})

// ─── addExtension / removeExtension ──────────────────────────────────────────
describe('Service.addExtension / removeExtension', () => {
    it('adds extension restriction to route', async () => {
        await Service.addExtension(routeId, extensionId)

        const route = await Service.getOutboundRouteById(routeId)
        expect(route.extensions.some((e: any) => e.extensionId === extensionId)).toBe(true)
    })

    it('throws 404 adding to unknown route', async () => {
        await expect(
            Service.addExtension('nonexistentcuid000000000', extensionId),
        ).rejects.toThrow('not found')
    })

    it('throws 404 adding unknown extension', async () => {
        await expect(
            Service.addExtension(routeId, 'nonexistentcuid000000000'),
        ).rejects.toThrow('not found')
    })

    it('removes extension restriction from route', async () => {
        await Service.removeExtension(routeId, extensionId)

        const route = await Service.getOutboundRouteById(routeId)
        expect(route.extensions.every((e: any) => e.extensionId !== extensionId)).toBe(true)
    })

    it('throws 404 removing non-existent extension link', async () => {
        await expect(
            Service.removeExtension(routeId, extensionId),
        ).rejects.toThrow('not found')
    })
})

// ─── deleteOutboundRoute ──────────────────────────────────────────────────────
describe('Service.deleteOutboundRoute', () => {
    it('removes route and cleans dialplan', async () => {
        await Service.deleteOutboundRoute(routeId)

        const dialplan = await prisma.extensions.findMany({
            where: { context: 'ramais', exten: '_55ZX9XXXXXXXX' },
        })
        expect(dialplan).toHaveLength(0)

        await expect(Service.getOutboundRouteById(routeId)).rejects.toThrow('not found')
    })

    it('throws 404 for unknown id', async () => {
        await expect(
            Service.deleteOutboundRoute('nonexistentcuid000000000'),
        ).rejects.toThrow('not found')
    })
})
