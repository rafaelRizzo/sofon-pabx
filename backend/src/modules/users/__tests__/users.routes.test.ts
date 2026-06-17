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
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
})

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// -------------------------------------------------- GET /users
describe('GET /users', () => {
    it('200 returns list of users', async () => {
        const res = await app.inject({ method: 'GET', url: '/users', headers: auth() })

        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(Array.isArray(body.users)).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: '/users' })
        expect(res.statusCode).toBe(401)
    })
})

// ------------------------------------------------- GET /users/:id
describe('GET /users/:id', () => {
    it('200 returns user by id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().user.id).toBe(userId)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('400 with id outside cuid2 format', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/users/invalid-id',
            headers: auth(),
        })

        expect(res.statusCode).toBe(400)
    })
})

// ------------------------------------------------- POST /users
describe('POST /users', () => {
    it('201 creates new user', async () => {
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

    it('400 with invalid body', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: { username: 'not-email', password: '123' },
        })

        expect(res.statusCode).toBe(400)
    })

    it('409 with duplicate username', async () => {
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
    it('200 updates user', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/users/${userId}`,
            headers: auth(),
            body: { name: 'Updated Name' },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('404 with non-existent id', async () => {
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
    it('200 returns the own user companies', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}/companies`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(Array.isArray(res.json().companies)).toBe(true)
    })

    it('403 when accessing another user companies without admin permission', async () => {
        const nonAdminPwd = 'non-admin-pwd-123'
        await prisma.user.create({
            data: {
                name: 'Non Admin',
                username: `${PREFIX}nonadmin@test.com`,
                password: await argon2.hash(nonAdminPwd),
            },
        })

        const login = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: `${PREFIX}nonadmin@test.com`, password: nonAdminPwd },
        })
        const nonAdminToken = login.json().token

        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}/companies`,
            headers: { authorization: `Bearer ${nonAdminToken}` },
        })

        expect(res.statusCode).toBe(403)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/users/${userId}/companies`,
        })

        expect(res.statusCode).toBe(401)
    })
})

// ----------------------------------------------- DELETE /users/:id
describe('DELETE /users/:id', () => {
    it('200 deletes user', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/users',
            headers: auth(),
            body: {
                name: 'To Delete',
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

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/users/${userId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})
