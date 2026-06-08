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

    // login real p/ obter tokens
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
    it('200 com credenciais válidas', async () => {
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

    it('401 com senha errada', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: EMAIL, password: 'errada123' },
        })

        expect(res.statusCode).toBe(401)
        expect(res.json().success).toBe(false)
    })

    it('400 com username fora do formato email', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            body: { username: 'nao-e-email', password: PASSWORD },
        })

        expect(res.statusCode).toBe(400)
    })
})

// ----------------------------------------------- POST /auth/register
describe('POST /auth/register', () => {
    it('403 quando já existe um usuário no sistema', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            body: { name: 'Novo User', username: `${PREFIX}_register@test.com`, password: PASSWORD },
        })

        expect(res.statusCode).toBe(403)
    })

    it('400 com body inválido', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/register',
            body: { username: 'nao-email', password: '123' },
        })

        expect(res.statusCode).toBe(400)
    })
})

// ----------------------------------------------- POST /auth/refresh
describe('POST /auth/refresh', () => {
    it('200 com cookie de refresh válido', async () => {
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

    it('401 sem cookie de refresh', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/refresh' })

        expect(res.statusCode).toBe(401)
    })
})

// ----------------------------------------------- POST /auth/logout
describe('POST /auth/logout', () => {
    it('200 com token válido e limpa cookie', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/logout',
            headers: { authorization: `Bearer ${accessToken}` },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
    })

    it('401 sem token', async () => {
        const res = await app.inject({ method: 'POST', url: '/auth/logout' })

        expect(res.statusCode).toBe(401)
    })
})
