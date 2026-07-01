import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListTimeGroupsResponse, GetTimeGroupResponse, CreateTimeGroupResponse } from '../schemas/time-group.schema'

const TS = String(Date.now())
const PREFIX = `__test_tg_routes_${TS}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let groupId: string

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

    const loginRes = await app.inject({
        method: 'POST', url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
}, 30000)

afterAll(async () => {
    await prisma.timeGroup.deleteMany({ where: { companyId } })
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
}, 30000)

const auth = () => ({ authorization: `Bearer ${accessToken}` })
const RANGE = { startTime: '08:00', endTime: '18:00', weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] }

// ─── POST /time-groups ────────────────────────────────────────────────────────
describe('POST /time-groups', () => {
    it('201 creates time group', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-groups',
            headers: auth(),
            body: { name: 'comercial', companyId, ranges: [RANGE] },
        })
        expect(res.statusCode).toBe(201)
        const body = CreateTimeGroupResponse.parse(res.json())
        expect(body.timeGroupId).toBeTruthy()
        groupId = body.timeGroupId
    })

    it('409 duplicate name in same company', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-groups',
            headers: auth(),
            body: { name: 'comercial', companyId, ranges: [RANGE] },
        })
        expect(res.statusCode).toBe(409)
    })

    it('400 invalid time format', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-groups',
            headers: auth(),
            body: { name: 'bad', companyId, ranges: [{ ...RANGE, startTime: '8:00' }] },
        })
        expect(res.statusCode).toBe(400)
    })

    it('400 empty weekdays', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-groups',
            headers: auth(),
            body: { name: 'bad', companyId, ranges: [{ ...RANGE, weekdays: [] }] },
        })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-groups',
            body: { name: 'x', companyId, ranges: [RANGE] },
        })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /time-groups ─────────────────────────────────────────────────────────
describe('GET /time-groups', () => {
    it('200 lists groups by company', async () => {
        const res = await app.inject({
            method: 'GET', url: `/time-groups?companyId=${companyId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
        const body = ListTimeGroupsResponse.parse(res.json())
        expect(Array.isArray(body.timeGroups)).toBe(true)
        expect(body.timeGroups.some((g) => g.id === groupId)).toBe(true)
    })

    it('400 missing companyId query', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-groups', headers: auth() })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/time-groups?companyId=${companyId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /time-groups/:id ─────────────────────────────────────────────────────
describe('GET /time-groups/:id', () => {
    it('200 returns group with ranges', async () => {
        const res = await app.inject({ method: 'GET', url: `/time-groups/${groupId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const { timeGroup } = GetTimeGroupResponse.parse(res.json())
        expect(timeGroup.id).toBe(groupId)
        expect(timeGroup.name).toBe('comercial')
        expect(Array.isArray(timeGroup.ranges)).toBe(true)
        expect(timeGroup.ranges[0].startTime).toBe('08:00')
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-groups/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('400 invalid id format', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-groups/invalid', headers: auth() })
        expect(res.statusCode).toBe(400)
    })
})

// ─── PUT /time-groups/:id ─────────────────────────────────────────────────────
describe('PUT /time-groups/:id', () => {
    it('200 updates name', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/time-groups/${groupId}`,
            headers: auth(),
            body: { name: 'comercial-atualizado' },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('200 replaces ranges', async () => {
        const newRange = { startTime: '09:00', endTime: '17:00', weekdays: ['mon', 'fri'] }
        const res = await app.inject({
            method: 'PUT', url: `/time-groups/${groupId}`,
            headers: auth(),
            body: { ranges: [newRange] },
        })
        expect(res.statusCode).toBe(200)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT', url: '/time-groups/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'x' },
        })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'PUT', url: `/time-groups/${groupId}`, body: { name: 'x' } })
        expect(res.statusCode).toBe(401)
    })
})

// ─── DELETE /time-groups/:id ──────────────────────────────────────────────────
describe('DELETE /time-groups/:id', () => {
    it('200 deletes group', async () => {
        const created = await app.inject({
            method: 'POST', url: '/time-groups',
            headers: auth(),
            body: { name: 'to-delete', companyId, ranges: [RANGE] },
        })
        const idToDelete = created.json().timeGroupId

        const res = await app.inject({ method: 'DELETE', url: `/time-groups/${idToDelete}`, headers: auth() })
        expect(res.statusCode).toBe(200)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/time-groups/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/time-groups/${groupId}` })
        expect(res.statusCode).toBe(401)
    })
})
