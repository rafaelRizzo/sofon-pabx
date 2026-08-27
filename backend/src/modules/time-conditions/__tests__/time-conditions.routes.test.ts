import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListTimeConditionsResponse, GetTimeConditionResponse, CreateTimeConditionResponse } from '../schemas/time-condition.schema'

const TS = String(Date.now())
const PREFIX = `__test_tc_routes_${TS}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let groupId: string
let conditionId: string

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

    const group = await prisma.timeGroup.create({
        data: {
            name: 'comercial',
            companyId,
            ranges: { create: [{ startTime: '08:00', endTime: '18:00', weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] }] },
        },
    })
    groupId = group.id

    const loginRes = await app.inject({
        method: 'POST', url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
}, 30000)

afterAll(async () => {
    // DELETE /companies/:id já limpa cascata completa (dialplan de timeconditions inclusive) -
    // evita deixar dialplan órfão em `extensions` como o cleanup manual fazia
    await app.inject({ method: 'DELETE', url: `/companies/${companyId}`, headers: auth() })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
}, 30000)

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ─── POST /time-conditions ────────────────────────────────────────────────────
describe('POST /time-conditions', () => {
    it('201 creates condition with hangup routes', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: {
                name: 'horario-comercial', companyId,
                trueRoute: { type: 'hangup' },
                falseRoute: { type: 'hangup' },
                groupIds: [groupId],
            },
        })
        expect(res.statusCode).toBe(201)
        const body = CreateTimeConditionResponse.parse(res.json())
        expect(body.timeConditionId).toBeTruthy()
        conditionId = body.timeConditionId
    })

    it('201 creates without routes or groups', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'simples', companyId },
        })
        expect(res.statusCode).toBe(201)
        const id = res.json().timeConditionId
        await app.inject({ method: 'DELETE', url: `/time-conditions/${id}`, headers: auth() })
    })

    it('409 duplicate name in same company', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'horario-comercial', companyId },
        })
        expect(res.statusCode).toBe(409)
    })

    it('400 invalid route format - string instead of object', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'bad', companyId, trueRoute: 'invalid' },
        })
        expect(res.statusCode).toBe(400)
    })

    it('400 invalid route type', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'bad', companyId, trueRoute: { type: 'unknown' } },
        })
        expect(res.statusCode).toBe(400)
    })

    it('404 group from different company', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'bad2', companyId, groupIds: ['clxxxxxxxxxxxxxxxxxxxxxxxxx'] },
        })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST', url: '/time-conditions',
            body: { name: 'x', companyId },
        })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /time-conditions ─────────────────────────────────────────────────────
describe('GET /time-conditions', () => {
    it('200 lists conditions by company', async () => {
        const res = await app.inject({
            method: 'GET', url: `/time-conditions?companyId=${companyId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
        const body = ListTimeConditionsResponse.parse(res.json())
        expect(Array.isArray(body.timeConditions)).toBe(true)
        expect(body.timeConditions.some((tc) => tc.id === conditionId)).toBe(true)
    })

    it('200 lists all time conditions without companyId query', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-conditions', headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = ListTimeConditionsResponse.parse(res.json())
        expect(Array.isArray(body.timeConditions)).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/time-conditions?companyId=${companyId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /time-conditions/:id ─────────────────────────────────────────────────
describe('GET /time-conditions/:id', () => {
    it('200 returns condition with time groups', async () => {
        const res = await app.inject({ method: 'GET', url: `/time-conditions/${conditionId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const { timeCondition } = GetTimeConditionResponse.parse(res.json())
        expect(timeCondition.id).toBe(conditionId)
        expect(timeCondition.name).toBe('horario-comercial')
        expect(timeCondition.trueRoute?.type).toBe('hangup')
        expect(Array.isArray(timeCondition.timeGroups)).toBe(true)
        expect(timeCondition.timeGroups[0]?.timeGroup.id).toBe(groupId)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-conditions/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('400 invalid id format', async () => {
        const res = await app.inject({ method: 'GET', url: '/time-conditions/invalid', headers: auth() })
        expect(res.statusCode).toBe(400)
    })
})

// ─── PUT /time-conditions/:id ─────────────────────────────────────────────────
describe('PUT /time-conditions/:id', () => {
    it('200 updates name and routes', async () => {
        const res = await app.inject({
            method: 'PUT', url: `/time-conditions/${conditionId}`,
            headers: auth(),
            body: { name: 'horario-comercial-v2', falseRoute: { type: 'hangup' } },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT', url: '/time-conditions/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'x' },
        })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'PUT', url: `/time-conditions/${conditionId}`, body: { name: 'x' } })
        expect(res.statusCode).toBe(401)
    })
})

// ─── DELETE /time-conditions/:id ─────────────────────────────────────────────
describe('DELETE /time-conditions/:id', () => {
    it('200 deletes condition and dialplan', async () => {
        const created = await app.inject({
            method: 'POST', url: '/time-conditions',
            headers: auth(),
            body: { name: 'to-delete', companyId },
        })
        const idToDelete = created.json().timeConditionId

        const res = await app.inject({ method: 'DELETE', url: `/time-conditions/${idToDelete}`, headers: auth() })
        expect(res.statusCode).toBe(200)

        const dialplan = await prisma.extensions.findFirst({ where: { context: 'timeconditions', exten: { contains: idToDelete } } })
        expect(dialplan).toBeNull()
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/time-conditions/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/time-conditions/${conditionId}` })
        expect(res.statusCode).toBe(401)
    })
})
