import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListQueuesResponse, GetQueueResponse, CreateQueueResponse } from '../schemas/queue.schema'
import { ListMembersResponse, AddMemberResponse } from '../../queue-members/schemas/queue-member.schema'

const TS = String(Date.now())
const PREFIX = `__test_queues_routes_${TS}__`
const EMAIL = `${PREFIX}@test.com`
const EXT_NUM = TS.slice(-6)
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let extensionId: string
let queueId: string
let memberId: string

beforeAll(async () => {
    app = await buildApp()

    const user = await prisma.user.create({
        data: { name: 'Admin', username: EMAIL, password: await argon2.hash(PASSWORD), role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: { name: `${PREFIX} Company`, metadata: {}, users: { create: { userId } } },
    })
    companyId = company.id

    const ext = await prisma.extension.create({
        data: {
            alias: EXT_NUM.slice(-4),
            number: EXT_NUM,
            type: 'pjsip',
            name: 'Agent 1',
            companyId,
        },
    })
    extensionId = ext.id

    const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
}, 30000)

afterAll(async () => {
    // DELETE /companies/:id já limpa cascata completa (queues-app, queue realtime, dialplan de
    // extension, etc.) — evita deixar dialplan órfão em `extensions` como o cleanup manual fazia
    await app.inject({ method: 'DELETE', url: `/companies/${companyId}`, headers: auth() })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
}, 30000)

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ─── POST /queues ──────────────────────────────────────────────────────────────
describe('POST /queues', () => {
    it('201 creates queue with defaults', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: { name: 'suporte', companyId, number: '100' },
        })
        expect(res.statusCode).toBe(201)
        const body = CreateQueueResponse.parse(res.json())
        expect(body.queueId).toBeTruthy()
        queueId = body.queueId
    })

    it('201 creates queue with all options', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: {
                name: 'vendas',
                companyId,
                number: '200',
                strategy: 'leastrecent',
                musicOnHold: 'jazz',
                timeout: 30,
                retry: 10,
                maxLen: 10,
                wrapupTime: 5,
                announce: 'queue-thankyou',
                announceFrequency: 30,
                joinEmpty: false,
                leaveWhenEmpty: true,
                weight: 5,
            },
        })
        expect(res.statusCode).toBe(201)
        const created = res.json().queueId
        await app.inject({ method: 'DELETE', url: `/queues/${created}`, headers: auth() })
    })

    it('409 duplicate name in the same company', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: { name: 'suporte', companyId, number: '101' },
        })
        expect(res.statusCode).toBe(409)
    })

    it('400 invalid strategy', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: { name: 'qtest', companyId, strategy: 'invalid' },
        })
        expect(res.statusCode).toBe(400)
    })

    it('400 name with spaces', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: { name: 'fila com espacos', companyId },
        })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'POST', url: '/queues', body: { name: 'x', companyId } })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /queues ───────────────────────────────────────────────────────────────
describe('GET /queues', () => {
    it('200 lists all queues', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues', headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = ListQueuesResponse.parse(res.json())
        expect(Array.isArray(body.queues)).toBe(true)
    })

    it('200 filters by companyId', async () => {
        const res = await app.inject({ method: 'GET', url: `/queues?companyId=${companyId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const body = ListQueuesResponse.parse(res.json())
        expect(Array.isArray(body.queues)).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues' })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /queues/company/:id_company ──────────────────────────────────────────
describe('GET /queues/company/:id_company', () => {
    it('200 returns queues from company', async () => {
        const res = await app.inject({ method: 'GET', url: `/queues/company/${companyId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const queues = res.json().queues
        expect(Array.isArray(queues)).toBe(true)
        expect(queues.some((q: any) => q.id === queueId)).toBe(true)
    })

    it('404 non-existent company', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues/company/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: `/queues/company/${companyId}` })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /queues/:id ──────────────────────────────────────────────────────────
describe('GET /queues/:id', () => {
    it('200 returns queue by id', async () => {
        const res = await app.inject({ method: 'GET', url: `/queues/${queueId}`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const { queue } = GetQueueResponse.parse(res.json())
        expect(queue.id).toBe(queueId)
        expect(queue.name).toBe('suporte')
        expect(queue.strategy).toBe('ringall')
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('400 invalid cuid format', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues/invalid-id', headers: auth() })
        expect(res.statusCode).toBe(400)
    })
})

// ─── PUT /queues/:id ──────────────────────────────────────────────────────────
describe('PUT /queues/:id', () => {
    it('200 updates queue settings', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/queues/${queueId}`,
            headers: auth(),
            body: { strategy: 'random', timeout: 20, retry: 8 },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('400 invalid strategy value', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/queues/${queueId}`,
            headers: auth(),
            body: { strategy: 'invalid' },
        })
        expect(res.statusCode).toBe(400)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/queues/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { timeout: 10 },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── POST /queues/:id/members ─────────────────────────────────────────────────
describe('POST /queues/:id/members', () => {
    it('201 adds extension as member', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/queues/${queueId}/members`,
            headers: auth(),
            body: { extensionId, penalty: 0 },
        })
        expect(res.statusCode).toBe(201)
        const body = AddMemberResponse.parse(res.json())
        expect(body.memberId).toBeTruthy()
        memberId = body.memberId
    })

    it('409 extension already member', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/queues/${queueId}/members`,
            headers: auth(),
            body: { extensionId, penalty: 0 },
        })
        expect(res.statusCode).toBe(409)
    })

    it('404 non-existent queue', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/queues/clxxxxxxxxxxxxxxxxxxxxxxxxx/members',
            headers: auth(),
            body: { extensionId, penalty: 0 },
        })
        expect(res.statusCode).toBe(404)
    })

    it('400 invalid extensionId', async () => {
        const res = await app.inject({
            method: 'POST',
            url: `/queues/${queueId}/members`,
            headers: auth(),
            body: { extensionId: 'not-a-cuid', penalty: 0 },
        })
        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'POST', url: `/queues/${queueId}/members`, body: { extensionId } })
        expect(res.statusCode).toBe(401)
    })
})

// ─── GET /queues/:id/members ──────────────────────────────────────────────────
describe('GET /queues/:id/members', () => {
    it('200 returns queue members', async () => {
        const res = await app.inject({ method: 'GET', url: `/queues/${queueId}/members`, headers: auth() })
        expect(res.statusCode).toBe(200)
        const { members } = ListMembersResponse.parse(res.json())
        expect(Array.isArray(members)).toBe(true)
        expect(members.some((m) => m.id === memberId)).toBe(true)
    })

    it('404 non-existent queue', async () => {
        const res = await app.inject({ method: 'GET', url: '/queues/clxxxxxxxxxxxxxxxxxxxxxxxxx/members', headers: auth() })
        expect(res.statusCode).toBe(404)
    })
})

// ─── PUT /queues/:id/members/:memberId ────────────────────────────────────────
describe('PUT /queues/:id/members/:memberId', () => {
    it('200 updates member penalty and paused', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/queues/${queueId}/members/${memberId}`,
            headers: auth(),
            body: { penalty: 5, paused: true },
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('404 non-existent member', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/queues/${queueId}/members/clxxxxxxxxxxxxxxxxxxxxxxxxx`,
            headers: auth(),
            body: { penalty: 1 },
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── DELETE /queues/:id/members/:memberId ─────────────────────────────────────
describe('DELETE /queues/:id/members/:memberId', () => {
    it('200 removes member', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/queues/${queueId}/members/${memberId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('404 already removed', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/queues/${queueId}/members/${memberId}`,
            headers: auth(),
        })
        expect(res.statusCode).toBe(404)
    })
})

// ─── DELETE /queues/:id ───────────────────────────────────────────────────────
describe('DELETE /queues/:id', () => {
    it('200 deletes queue', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/queues',
            headers: auth(),
            body: { name: 'to-delete', companyId, number: '300' },
        })
        const idToDelete = created.json().queueId

        const res = await app.inject({ method: 'DELETE', url: `/queues/${idToDelete}`, headers: auth() })
        expect(res.statusCode).toBe(200)
    })

    it('404 non-existent id', async () => {
        const res = await app.inject({ method: 'DELETE', url: '/queues/clxxxxxxxxxxxxxxxxxxxxxxxxx', headers: auth() })
        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'DELETE', url: `/queues/${queueId}` })
        expect(res.statusCode).toBe(401)
    })
})
