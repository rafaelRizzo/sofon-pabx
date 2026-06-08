import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'

const PREFIX = `__test_users_routes_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken: string
let userId: string

beforeAll(async () => {
    app = await buildApp()

    const user = await prisma.user.create({
        data: {
            name: 'Test User',
            username: EMAIL,
            password: await argon2.hash(PASSWORD),
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
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
})

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// -------------------------------------------------- GET /users
describe('GET /users', () => {
    it('200 retorna lista de users', async () => {
        const res = await app.inject({ method: 'GET', url: '/users', headers: auth() })

        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(Array.isArray(body.users)).toBe(true)
    })

    it('401 sem token', async () => {
        const res = await app.inject({ method: 'GET', url: '/users' })
        expect(res.statusCode).toBe(401)
    })
})

// ------------------------------------------------- GET /users/:id
describe('GET /users/:id', () => {
    it('200 retorna user pelo id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().user.id).toBe(userId)
    })

    it('404 com id inexistente', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('400 com id fora do formato cuid2', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/id-invalido',
            headers: auth(),
        })

        expect(res.statusCode).toBe(400)
    })
})

// ------------------------------------------------- POST /users
describe('POST /users', () => {
    it('201 cria novo user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: {
                name: 'Created Via Route',
                username: `${PREFIX}created@test.com`,
                password: PASSWORD,
            },
        })

        expect(res.statusCode).toBe(201)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(body.userId).toBeTruthy()
    })

    it('400 com body inválido', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: { username: 'nao-email', password: '123' },
        })

        expect(res.statusCode).toBe(400)
    })

    it('409 com username duplicado', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: { name: 'Dup', username: EMAIL, password: PASSWORD },
        })

        expect(res.statusCode).toBe(409)
    })
})

// ------------------------------------------------- PUT /users/:id
describe('PUT /users/:id', () => {
    it('200 atualiza user', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/users/${userId}`,
            headers: auth(),
            body: { name: 'Nome Atualizado' },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('404 com id inexistente', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/users/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'X' },
        })

        expect(res.statusCode).toBe(404)
    })
})

// ----------------------------------------- GET /users/:id/companies
describe('GET /users/:id/companies', () => {
    it('200 retorna empresas do próprio usuário', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}/companies`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.json().companies)).toBe(true)
    })

    it('403 ao acessar empresas de outro usuário sem permissão admin', async () => {
        const other = await prisma.user.create({
            data: {
                name: 'Other User',
                username: `${PREFIX}other@test.com`,
                password: 'x',
            },
        })

        const res = await app.inject({
            method: 'GET',
            url: `/users/${other.id}/companies`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(403)
    })

    it('401 sem token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}/companies`,
        })

        expect(res.statusCode).toBe(401)
    })
})

// ----------------------------------------------- DELETE /users/:id
describe('DELETE /users/:id', () => {
    it('200 deleta user', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: {
                name: 'Para Deletar',
                username: `${PREFIX}todelete@test.com`,
                password: PASSWORD,
            },
        })
        const idToDelete = created.json().userId

        const res = await app.inject({
            method: 'DELETE',
            url: `/users/${idToDelete}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
    })

    it('401 sem token', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/users/${userId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})
