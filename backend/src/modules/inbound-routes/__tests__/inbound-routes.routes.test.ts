import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListInboundRoutesResponse, GetInboundRouteResponse, CreateInboundRouteResponse } from '../schemas/inbound-route.schema'
import { TRUNK_ROUTED_CONTEXT } from '../../../asterisk/inboundroute.repository'

const TS = String(Date.now())
const PREFIX = `__test_ir_routes_${TS}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let didId: string
let didNumber: string
let trunkId: string
let routeId: string

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

    const did = await prisma.did.create({
        data: { number: `55119${TS.slice(-8)}`, companyId },
    })
    didId = did.id
    didNumber = did.number

    const trunk = await prisma.trunk.create({
        data: { name: `tk${TS.slice(-8)}`, companyId, registrationMode: 'inbound' },
    })
    trunkId = trunk.id

    const loginRes = await app.inject({
        method: 'POST', url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
}, 30000)

afterAll(async () => {
    // DELETE /companies/:id já limpa cascata completa (dialplan de from-trunk-routed inclusive) —
    // evita deixar dialplan órfão em `extensions` como o cleanup manual fazia
    await app.inject({ method: 'DELETE', url: `/companies/${companyId}`, headers: auth() })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
}, 30000)

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ─── POST /inbound-routes ─────────────────────────────────────────────────────
describe('POST /inbound-routes', () => {
    it('201 creates route with hangup destination', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'entrada-principal', companyId, didId, trunkId },
        })
        expect(res.statusCode).toBe(201)
        const body = CreateInboundRouteResponse.parse(res.json())
        expect(body.inboundRouteId).toBeTruthy()
        routeId = body.inboundRouteId

        const dialplan = await prisma.extensions.findFirst({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: `${didNumber}_${trunkId}`, app: 'Hangup' },
        })
        expect(dialplan).not.toBeNull()
    })

    it('409 duplicate trunk+DID combination', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'duplicado', companyId, didId, trunkId },
        })
        expect(res.statusCode).toBe(409)
    })

    it('400 missing required fields', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'bad', companyId },
        })
        expect(res.statusCode).toBe(400)
    })

    it('400 invalid destination type', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'bad', companyId, didId, trunkId, destination: { type: 'unknown' } },
        })
        expect(res.statusCode).toBe(400)
    })

    it('404 DID not found', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'bad', companyId, didId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', trunkId },
        })
        expect(res.statusCode).toBe(404)
    })

    it('404 trunk not found', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            headers: auth(),
            body: { name: 'bad', companyId, didId, trunkId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' },
        })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST', url: '/inbound-routes',
            body: { name: 'x', companyId, didId, trunkId },
        })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /inbound-routes ──────────────────────────────────────────────────────
describe('GET /inbound-routes', () => {
    it('200 lists routes by company', async () => {
        const res = await app.inject({
            method: 'GET', url: `/inbound-routes?companyId=${companyId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
        const body = ListInboundRoutesResponse.parse(res.json())
        expect(Array.isArray(body.inboundRoutes)).toBe(true)
        expect(body.inboundRoutes.some((r) => r.id === routeId)).toBe(true)
    })

    it('400 missing companyId query', async () => {
        const res = await app.inject({ method: 'GET', url: '/inbound-routes', headers: auth() })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/inbound-routes?companyId=${companyId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /inbound-routes/:id ──────────────────────────────────────────────────
describe('GET /inbound-routes/:id', () => {
    it('200 returns route with DID and trunk', async () => {
        const res = await app.inject({ method: 'GET', url: `/inbound-routes/${routeId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const { inboundRoute } = GetInboundRouteResponse.parse(res.json())
        expect(inboundRoute.id).toBe(routeId)
        expect(inboundRoute.did.id).toBe(didId)
        expect(inboundRoute.trunk.id).toBe(trunkId)
        expect(inboundRoute.destination).toBeNull()
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'GET', url: '/inbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('400 invalid id format', async () => {
        const res = await app.inject({ method: 'GET', url: '/inbound-routes/invalid', headers: auth() })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/inbound-routes/${routeId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── PUT /inbound-routes/:id ──────────────────────────────────────────────────
describe('PUT /inbound-routes/:id', () => {
    it('200 updates name', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/inbound-routes/${routeId}`,
            headers: auth(),
            body: { name: 'entrada-atualizada' },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('200 updates destination to hangup', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/inbound-routes/${routeId}`,
            headers: auth(),
            body: { destination: { type: 'hangup' } },
        })
        expect(res.statusCode).toBe(200)

        const dialplan = await prisma.extensions.findFirst({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: `${didNumber}_${trunkId}`, app: 'Hangup' },
        })
        expect(dialplan).not.toBeNull()
    })

    it('400 empty body', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/inbound-routes/${routeId}`,
            headers: auth(),
            body: {},
        })
        expect(res.statusCode).toBe(400)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT', url: '/inbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'x' },
        })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'PUT', url: `/inbound-routes/${routeId}`, body: { name: 'x' } })
        expect(res.statusCode).toBe(401)
    })
})

// ─── DELETE /inbound-routes/:id ───────────────────────────────────────────────
describe('DELETE /inbound-routes/:id', () => {
    it('401 without token', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/inbound-routes/${routeId}` })
        expect(res.statusCode).toBe(401)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/inbound-routes/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('200 deletes route and removes dialplan entry', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/inbound-routes/${routeId}`, headers: auth() })
        expect(res.statusCode).toBe(200)

        const dialplan = await prisma.extensions.findFirst({
            where: { context: TRUNK_ROUTED_CONTEXT, exten: `${didNumber}_${trunkId}` },
        })
        expect(dialplan).toBeNull()
    })
})
