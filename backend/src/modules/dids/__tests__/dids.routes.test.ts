import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'

const PREFIX = `__test_dids_routes_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let didId: string

beforeAll(async () => {
    app = await buildApp()

    const user = await prisma.user.create({
        data: { name: 'Admin', username: EMAIL, password: await argon2.hash(PASSWORD), role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: {
            name: `${PREFIX} Company`,
            metadata: {},
            users: { create: { userId } },
        },
    })
    companyId = company.id

    const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
})

afterAll(async () => {
    await prisma.did.deleteMany({ where: { companyId } })
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
})

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ---------------------------------------- GET /dids
describe('GET /dids', () => {
    it('200 admin lista todos os DIDs sem companyId', async () => {
        const res = await app.inject({ method: 'GET', url: '/dids', headers: auth() })

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.json().dids)).toBe(true)
    })

    it('200 admin lista DIDs filtrando por companyId', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/dids?companyId=${companyId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.json().dids)).toBe(true)
    })

    it('401 sem token', async () => {
        const res = await app.inject({ method: 'GET', url: '/dids' })
        expect(res.statusCode).toBe(401)
    })
})

// -------------------------------- GET /dids/company/:id_company
describe('GET /dids/company/:id_company', () => {
    it('200 retorna DIDs da company', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/dids/company/${companyId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.json().dids)).toBe(true)
    })

    it('404 com companyId inexistente', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/dids/company/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('401 sem token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/dids/company/${companyId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})

// ------------------------------------------------- POST /dids
describe('POST /dids', () => {
    it('201 cria DID', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/dids',
            headers: auth(),
            body: { number: '551100001111', companyId },
        })

        expect(res.statusCode).toBe(201)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(body.didId).toBeTruthy()
        didId = body.didId
    })

    it('409 com número duplicado na mesma company', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/dids',
            headers: auth(),
            body: { number: '551100001111', companyId },
        })

        expect(res.statusCode).toBe(409)
    })

    it('400 com número não numérico', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/dids',
            headers: auth(),
            body: { number: '551abc', companyId },
        })

        expect(res.statusCode).toBe(400)
    })

    it('400 com body inválido', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/dids',
            headers: auth(),
            body: {},
        })

        expect(res.statusCode).toBe(400)
    })

    it('401 sem token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/dids',
            body: { number: '123', companyId },
        })

        expect(res.statusCode).toBe(401)
    })
})

// ---------------------------------------------- GET /dids/:id
describe('GET /dids/:id', () => {
    it('200 retorna DID pelo id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/dids/${didId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().did.id).toBe(didId)
    })

    it('404 com id inexistente', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/dids/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('400 com id fora do formato cuid2', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/dids/id-invalido',
            headers: auth(),
        })

        expect(res.statusCode).toBe(400)
    })
})

// ---------------------------------------------- PUT /dids/:id
describe('PUT /dids/:id', () => {
    it('200 atualiza DID', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/dids/${didId}`,
            headers: auth(),
            body: { number: '551100009999' },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('400 com número não numérico', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/dids/${didId}`,
            headers: auth(),
            body: { number: 'abc123' },
        })

        expect(res.statusCode).toBe(400)
    })

    it('404 com id inexistente', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/dids/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { number: '123' },
        })

        expect(res.statusCode).toBe(404)
    })
})

// ------------------------------------------- DELETE /dids/:id
describe('DELETE /dids/:id', () => {
    it('200 deleta DID', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/dids',
            headers: auth(),
            body: { number: '551100005555', companyId },
        })
        const idToDelete = created.json().didId

        const res = await app.inject({
            method: 'DELETE',
            url: `/dids/${idToDelete}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
    })

    it('404 com id inexistente', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/dids/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('401 sem token', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/dids/${didId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})
