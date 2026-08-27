import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import {
    ListOutboundRoutesResponse, GetOutboundRouteResponse, CreateOutboundRouteResponse,
    UpdateOutboundRouteResponse, SetTrunksResponse, AddPatternResponse, AddExtensionResponse,
} from '../schemas/outbound-route.schema'

const TS = String(Date.now())
const PREFIX = `__test_or_routes_${TS}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let trunkId: string
let extensionId: string
let routeId: string
let patternId: string

beforeAll(async () => {
    app = await buildApp()

    const user = await prisma.user.create({
        data: { name: 'Admin', username: EMAIL, password: await argon2.hash(PASSWORD), role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: { name: `${PREFIX} Co`, metadata: {}, users: { create: { userId } } },
    })
    companyId = company.id

    const trunk = await prisma.trunk.create({
        data: {
            name: `tk${TS.slice(-8)}`, companyId, registrationMode: 'outbound',
            host: '127.0.0.1', username: `tk${TS.slice(-8)}`, password: 'test-password-123',
        },
    })
    trunkId = trunk.id

    const extension = await prisma.extension.create({
        data: { alias: '2001', number: `2001_${TS.slice(-8)}`, type: 'pjsip', name: 'Agent', companyId },
    })
    extensionId = extension.id

    const loginRes = await app.inject({
        method: 'POST', url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
}, 30000)

afterAll(async () => {
    // DELETE /companies/:id já limpa cascata completa (dialplan de patterns no contexto ramais
    // inclusive) - evita deixar dialplan órfão em `extensions` como o cleanup manual fazia
    await app.inject({ method: 'DELETE', url: `/companies/${companyId}`, headers: auth() })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
}, 30000)

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ─── POST /outbound-routes ────────────────────────────────────────────────────
describe('POST /outbound-routes', () => {
    it('201 creates route with patterns and trunks', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes',
            headers: auth(),
            body: {
                name: 'Saidas',
                companyId,
                trunkIds: [trunkId],
                patterns: [{ pattern: '_0XXXXXXXX', position: 0 }],
            },
        })
        expect(res.statusCode).toBe(201)
        const body = CreateOutboundRouteResponse.parse(res.json())
        expect(body.outboundRouteId).toBeTruthy()
        routeId = body.outboundRouteId
    })

    it('404 when company not found', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes',
            headers: auth(),
            body: {
                name: 'X', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
                trunkIds: [trunkId], patterns: [{ pattern: '_X.', position: 0 }],
            },
        })
        expect(res.statusCode).toBe(404)
    })

    it('404 when trunk not found', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes',
            headers: auth(),
            body: {
                name: 'X', companyId,
                trunkIds: ['clxxxxxxxxxxxxxxxxxxxxxxxxx'], patterns: [{ pattern: '_X.', position: 0 }],
            },
        })
        expect(res.statusCode).toBe(404)
    })

    it('400 with invalid body', async () => {
        const res = await app.inject({ method: 'POST', url: '/outbound-routes', headers: auth(), body: {} })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes',
            body: { name: 'X', companyId, trunkIds: [trunkId], patterns: [{ pattern: '_X.', position: 0 }] },
        })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /outbound-routes ─────────────────────────────────────────────────────
describe('GET /outbound-routes', () => {
    it('200 lists routes filtering by companyId', async () => {
        const res = await app.inject({ method: 'GET', url: `/outbound-routes?companyId=${companyId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = ListOutboundRoutesResponse.parse(res.json())
        expect(body.routes.some((r) => r.id === routeId)).toBe(true)
    })

    it('200 lists all routes without companyId query', async () => {
        const res = await app.inject({ method: 'GET', url: '/outbound-routes', headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = ListOutboundRoutesResponse.parse(res.json())
        expect(Array.isArray(body.routes)).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/outbound-routes?companyId=${companyId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /outbound-routes/:id ─────────────────────────────────────────────────
describe('GET /outbound-routes/:id', () => {
    it('200 returns route with patterns and trunks', async () => {
        const res = await app.inject({ method: 'GET', url: `/outbound-routes/${routeId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = GetOutboundRouteResponse.parse(res.json())
        expect(body.route.id).toBe(routeId)
        expect(body.route.patterns.length).toBe(1)
        expect(body.route.trunks.length).toBe(1)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({ method: 'GET', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })
})

// ─── PUT /outbound-routes/:id ─────────────────────────────────────────────────
describe('PUT /outbound-routes/:id', () => {
    it('200 updates route name', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/outbound-routes/${routeId}`,
            headers: auth(), body: { name: 'Saidas Renomeada' },
        })
        expect(res.statusCode).toBe(200)
        const body = UpdateOutboundRouteResponse.parse(res.json())
        expect(body.route.name).toBe('Saidas Renomeada')
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(), body: { name: 'X' },
        })
        expect(res.statusCode).toBe(404)
    })

    it('400 with empty body', async () => {
        const res = await app.inject({ method: 'PUT', url: `/outbound-routes/${routeId}`, headers: auth(), body: {} })
        expect(res.statusCode).toBe(400)
    })
})

// ─── POST /outbound-routes/:id/patterns ───────────────────────────────────────
describe('POST /outbound-routes/:id/patterns', () => {
    it('201 adds pattern', async () => {
        const res = await app.inject({
            method: 'POST', url: `/outbound-routes/${routeId}/patterns`,
            headers: auth(), body: { pattern: '_00XXXXXXXX', position: 1 },
        })
        expect(res.statusCode).toBe(201)
        const body = AddPatternResponse.parse(res.json())
        expect(body.patternId).toBeTruthy()
        patternId = body.patternId
    })

    it('404 with non-existent route', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx/patterns',
            headers: auth(), body: { pattern: '_X.', position: 0 },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── PUT /outbound-routes/:id/patterns/:patternId ─────────────────────────────
describe('PUT /outbound-routes/:id/patterns/:patternId', () => {
    it('200 updates pattern', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/outbound-routes/${routeId}/patterns/${patternId}`,
            headers: auth(), body: { pattern: '_000XXXXXXXX' },
        })
        expect(res.statusCode).toBe(200)
    })

    it('404 with non-existent pattern', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/outbound-routes/${routeId}/patterns/clxxxxxxxxxxxxxxxxxxxxxxxxx`,
            headers: auth(), body: { pattern: '_X.' },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── PUT /outbound-routes/:id/trunks ──────────────────────────────────────────
describe('PUT /outbound-routes/:id/trunks', () => {
    it('200 replaces trunk list', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/outbound-routes/${routeId}/trunks`,
            headers: auth(), body: { trunkIds: [trunkId] },
        })
        expect(res.statusCode).toBe(200)
        const body = SetTrunksResponse.parse(res.json())
        expect(body.route.trunks.length).toBe(1)
    })

    it('404 with non-existent route', async () => {
        const res = await app.inject({
            method: 'PUT', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx/trunks',
            headers: auth(), body: { trunkIds: [trunkId] },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── POST /outbound-routes/:id/extensions ─────────────────────────────────────
describe('POST /outbound-routes/:id/extensions', () => {
    it('201 restricts route to extension', async () => {
        const res = await app.inject({
            method: 'POST', url: `/outbound-routes/${routeId}/extensions`,
            headers: auth(), body: { extensionId },
        })
        expect(res.statusCode).toBe(201)
        const body = AddExtensionResponse.parse(res.json())
        expect(body.outboundRouteExtensionId).toBeTruthy()
    })

    it('404 with non-existent route', async () => {
        const res = await app.inject({
            method: 'POST', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx/extensions',
            headers: auth(), body: { extensionId },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── DELETE /outbound-routes/:id/extensions/:extensionId ──────────────────────
describe('DELETE /outbound-routes/:id/extensions/:extensionId', () => {
    it('200 removes extension restriction', async () => {
        const res = await app.inject({
            method: 'DELETE', url: `/outbound-routes/${routeId}/extensions/${extensionId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
    })
})

// ─── DELETE /outbound-routes/:id/patterns/:patternId ──────────────────────────
describe('DELETE /outbound-routes/:id/patterns/:patternId', () => {
    it('200 removes pattern', async () => {
        const res = await app.inject({
            method: 'DELETE', url: `/outbound-routes/${routeId}/patterns/${patternId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
    })

    it('404 with non-existent pattern', async () => {
        const res = await app.inject({
            method: 'DELETE', url: `/outbound-routes/${routeId}/patterns/clxxxxxxxxxxxxxxxxxxxxxxxxx`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── DELETE /outbound-routes/:id ──────────────────────────────────────────────
describe('DELETE /outbound-routes/:id', () => {
    it('200 deletes route', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/outbound-routes/${routeId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/outbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/outbound-routes/${routeId}` })
        expect(res.statusCode).toBe(401)
    })
})
