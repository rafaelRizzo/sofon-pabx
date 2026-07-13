import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListCompaniesResponse, GetCompanyResponse, CreateCompanyResponse, UpdateCompanyResponse } from '../schemas/company.schema'

const PREFIX = `__test_companies_routes_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string

beforeAll(async () => {
    app = await buildApp()

    const user = await prisma.user.create({
        data: {
            name: 'Admin Test',
            username: EMAIL,
            password: await argon2.hash(PASSWORD),
            role: 'admin',
        },
    })
    userId = user.id

    const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
})

afterAll(async () => {
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
})

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ------------------------------------------------- GET /companies
describe('GET /companies', () => {
    it('200 returns list', async () => {
        const res = await app.inject({ method: 'GET', url: '/companies', headers: auth() })

        expect(res.statusCode).toBe(200)
        const body = ListCompaniesResponse.parse(res.json())
        expect(Array.isArray(body.companies)).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: '/companies' })
        expect(res.statusCode).toBe(401)
    })
})

// ------------------------------------------------- POST /companies
describe('POST /companies', () => {
    it('201 creates company linked to the own user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/companies',
            headers: auth(),
            body: { name: `${PREFIX} Speed SP`, metadata: {} },
        })

        expect(res.statusCode).toBe(201)
        const body = CreateCompanyResponse.parse(res.json())
        expect(body.companyId).toBeTruthy()
        companyId = body.companyId
    })

    it('201 ignores userId in body: company links to the creator, not the given userId', async () => {
        const other = await prisma.user.create({
            data: {
                name: 'Other',
                username: `${PREFIX}other@test.com`,
                password: 'x',
            },
        })

        const res = await app.inject({
            method: 'POST',
            url: '/companies',
            headers: auth(),
            body: { name: `${PREFIX} Speed RJ`, userId: other.id, metadata: {} },
        })

        expect(res.statusCode).toBe(201)
        const { companyId: newCompanyId } = CreateCompanyResponse.parse(res.json())
        const ownLink = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId: newCompanyId } },
        })
        const otherLink = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId: other.id, companyId: newCompanyId } },
        })
        expect(ownLink).not.toBeNull()
        expect(otherLink).toBeNull()
    })

    it('400 with invalid body', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/companies',
            headers: auth(),
            body: {},
        })

        expect(res.statusCode).toBe(400)
    })

    it('400 with invalid IANA timezone', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/companies',
            headers: auth(),
            body: { name: `${PREFIX} Bad TZ`, metadata: {}, timezone: 'Not/A_Timezone' },
        })

        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/companies',
            body: { name: `${PREFIX} X`, metadata: {} },
        })

        expect(res.statusCode).toBe(401)
    })
})

// ----------------------------------------------- GET /companies/:id
describe('GET /companies/:id', () => {
    it('200 returns company by id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/companies/${companyId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const body = GetCompanyResponse.parse(res.json())
        expect(body.company.id).toBe(companyId)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/companies/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('400 with id outside cuid2 format', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/companies/invalid-id',
            headers: auth(),
        })

        expect(res.statusCode).toBe(400)
    })
})

// ----------------------------------------------- PUT /companies/:id
describe('PUT /companies/:id', () => {
    it('200 updates company', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/companies/${companyId}`,
            headers: auth(),
            body: { name: `${PREFIX} Speed Updated` },
        })

        expect(res.statusCode).toBe(200)
        UpdateCompanyResponse.parse(res.json())
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/companies/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'X' },
        })

        expect(res.statusCode).toBe(404)
    })
})

// -------------------------------------------- DELETE /companies/:id
describe('DELETE /companies/:id', () => {
    it('200 deletes company', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/companies',
            headers: auth(),
            body: { name: `${PREFIX} To Delete`, metadata: {} },
        })
        const idToDelete = created.json().companyId

        const res = await app.inject({
            method: 'DELETE',
            url: `/companies/${idToDelete}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/companies/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/companies/${companyId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})
