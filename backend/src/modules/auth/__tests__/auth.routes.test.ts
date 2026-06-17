import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'

const PREFIX = `__test_auth_routes_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

let app: FastifyInstance
let accessToken = ''
let refreshCookie = ''

beforeAll(async () => {
    app = await buildApp()

    await prisma.user.create({
        data: {
            name: 'Test User',
            username: EMAIL,
            password: await argon2.hash(PASSWORD),
        },
    })

    // real login to obtain tokens
    const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = res.json().token
    refreshCookie = (res.headers['set-cookie'] as string[])[0] ?? ''
})

afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    await app.close()
    await disconnectRedis()
})

// -------------------------------------------------- POST /auth/login
describe('POST /auth/login', () => {
    it('200 with valid credentials', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: EMAIL, password: PASSWORD },
        })

        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(body.token).toBeTruthy()
        const cookies = res.headers['set-cookie'] as string[]
        expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true)
    })

    it('401 with wrong password', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: EMAIL, password: 'wrong123' },
        })

        expect(res.statusCode).toBe(401)
        expect(res.json().success).toBe(false)
    })

    it('400 with username not in email format', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: 'not-an-email', password: PASSWORD },
        })

        expect(res.statusCode).toBe(400)
    })
})

// ----------------------------------------------- POST /auth/register
describe('POST /auth/register', () => {
    it('403 when a user already exists in the system', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            body: { name: 'New User', username: `${PREFIX}_register@test.com`, password: PASSWORD },
        })

        expect(res.statusCode).toBe(403)
    })

    it('400 with invalid body', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            body: { username: 'not-email', password: '123' },
        })

        expect(res.statusCode).toBe(400)
    })
})

// ----------------------------------------------- POST /auth/refresh
describe('POST /auth/refresh', () => {
    it('200 with valid refresh cookie', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            headers: { cookie: refreshCookie },
        })

        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.success).toBe(true)
        expect(body.token).toBeTruthy()
    })

    it('401 without refresh cookie', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/refresh' })

        expect(res.statusCode).toBe(401)
    })
})

// ----------------------------------------------- POST /auth/logout
describe('POST /auth/logout', () => {
    it('200 with valid token and clears cookie', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/logout',
            headers: { authorization: `Bearer ${accessToken}` },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/logout' })

        expect(res.statusCode).toBe(401)
    })
})
