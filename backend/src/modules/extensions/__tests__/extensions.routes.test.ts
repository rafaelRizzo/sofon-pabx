import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../../lib/prisma'
import { buildApp } from '../../../test/build-app'
import { disconnectRedis } from '../../../config/redis'
import argon2 from 'argon2'
import { ListExtensionsResponse, GetExtensionResponse, CreateExtensionResponse, UpdateExtensionResponse, ResetPasswordResponse } from '../schemas/extension.schema'

const PREFIX = `__test_ext_routes_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'
const SIP_SECRET = 'verystrongpassword123456'

let app: FastifyInstance
let accessToken: string
let userId: string
let companyId: string
let sipId: string
let pjsipId: string

const cleanupAsteriskByCompany = async () => {
    const exts = await prisma.extension.findMany({
        where: { companyId },
        select: { alias: true, number: true, context: true },
    })

    for (const { alias, number, context } of exts) {
        await prisma.extensions.deleteMany({ where: { context, exten: alias } })
        await prisma.$executeRaw`DELETE FROM ps_endpoints WHERE id = ${number}`
        await prisma.$executeRaw`DELETE FROM ps_auths WHERE id = ${number}`
        await prisma.$executeRaw`DELETE FROM ps_aors WHERE id = ${number}`
        await prisma.sip_peers.deleteMany({ where: { name: number } })
    }

    await prisma.extension.deleteMany({ where: { companyId } })
}

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

    const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        body: { username: EMAIL, password: PASSWORD },
    })
    accessToken = loginRes.json().token
})

afterAll(async () => {
    if (companyId) {
        await cleanupAsteriskByCompany()
        await prisma.userCompany.deleteMany({ where: { userId } })
        await prisma.company.deleteMany({ where: { id: companyId } })
    }
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
    await prisma.$disconnect()
    if (app) await app.close()
    await disconnectRedis()
})

const auth = () => ({ authorization: `Bearer ${accessToken}` })

// ---------------------------------------- POST /extensions
describe('POST /extensions', () => {
    it('201 creates extension sip', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3001', type: 'sip', name: 'SIP', companyId },
        })

        expect(res.statusCode).toBe(201)
        const body = CreateExtensionResponse.parse(res.json())
        expect(body.extension.type).toBe('sip')
        sipId = body.extension.id
    })

    it('201 creates extension pjsip', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3002', type: 'pjsip', name: 'PJSIP', companyId },
        })

        expect(res.statusCode).toBe(201)
        const body = CreateExtensionResponse.parse(res.json())
        expect(body.extension.type).toBe('pjsip')
        pjsipId = body.extension.id
    })

    it('409 with duplicate alias', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3001', type: 'sip', name: 'Dup', companyId },
        })

        expect(res.statusCode).toBe(409)
    })

    it('400 when password field is provided (always auto-generated)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3050', type: 'sip', password: 'verystrongpassword123456', name: 'X', companyId },
        })

        expect(res.statusCode).toBe(400)
    })

    it('400 with alias outside regex', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: 'abc', type: 'sip', name: 'X', companyId },
        })

        expect(res.statusCode).toBe(400)
    })

    it('400 with invalid type', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3060', type: 'h323', name: 'X', companyId },
        })

        expect(res.statusCode).toBe(400)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            body: { alias: '3070', type: 'sip', name: 'X', companyId },
        })

        expect(res.statusCode).toBe(401)
    })
})

// ---------------------------------------- GET /extensions
describe('GET /extensions', () => {
    it('200 admin lists filtering by companyId grouped by type', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/extensions?companyId=${companyId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const { extensions } = ListExtensionsResponse.parse(res.json())
        expect(Array.isArray(extensions.sip)).toBe(true)
        expect(Array.isArray(extensions.pjsip)).toBe(true)
        expect(extensions.sip.length + extensions.pjsip.length).toBeGreaterThanOrEqual(2)
    })

    it('401 without token', async () => {
        const res = await app.inject({ method: 'GET', url: '/extensions' })
        expect(res.statusCode).toBe(401)
    })
})

// ---------------------------------------- GET /extensions/:id
describe('GET /extensions/:id', () => {
    it('200 returns extension sip by id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/extensions/${sipId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const body = GetExtensionResponse.parse(res.json())
        expect(body.extension.id).toBe(sipId)
    })

    it('200 returns extension pjsip by id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/extensions/${pjsipId}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const body = GetExtensionResponse.parse(res.json())
        expect(body.extension.type).toBe('pjsip')
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/extensions/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('400 with id outside cuid format', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/extensions/invalid-id',
            headers: auth(),
        })

        expect(res.statusCode).toBe(400)
    })
})

// ---------------------------------------- PUT /extensions/:id
describe('PUT /extensions/:id', () => {
    it('200 updates extension sip', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/extensions/${sipId}`,
            headers: auth(),
            body: { name: 'SIP Updated' },
        })

        expect(res.statusCode).toBe(200)
        const body1 = UpdateExtensionResponse.parse(res.json())
        expect(body1.extension.name).toBe('SIP Updated')
    })

    it('200 updates extension pjsip', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/extensions/${pjsipId}`,
            headers: auth(),
            body: { name: 'PJSIP Updated' },
        })

        expect(res.statusCode).toBe(200)
        const body2 = UpdateExtensionResponse.parse(res.json())
        expect(body2.extension.name).toBe('PJSIP Updated')
    })

    it('400 with empty body', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/extensions/${sipId}`,
            headers: auth(),
            body: {},
        })

        expect(res.statusCode).toBe(400)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/extensions/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
            body: { name: 'x' },
        })

        expect(res.statusCode).toBe(404)
    })
})

// ---------------------------------------- PATCH /extensions/:id/password
describe('PATCH /extensions/:id/password', () => {
    it('200 resets password for sip extension', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/extensions/${sipId}/password`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const body = ResetPasswordResponse.parse(res.json())
        expect(typeof body.password).toBe('string')
        expect(body.password.length).toBeGreaterThanOrEqual(16)
    })

    it('200 resets password for pjsip extension', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/extensions/${pjsipId}/password`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        const body2 = ResetPasswordResponse.parse(res.json())
        expect(typeof body2.password).toBe('string')
        expect(body2.password.length).toBeGreaterThanOrEqual(16)
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/extensions/clxxxxxxxxxxxxxxxxxxxxxxxxx/password',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/extensions/${sipId}/password`,
        })

        expect(res.statusCode).toBe(401)
    })
})

// ---------------------------------------- allowOutbound
describe('allowOutbound field', () => {
    it('201 creates sip with allowOutbound false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3090', type: 'sip', name: 'No Outbound SIP', companyId, allowOutbound: false },
        })

        expect(res.statusCode).toBe(201)
        expect(res.json().extension.allowOutbound).toBe(false)
    })

    it('201 creates pjsip with allowOutbound false', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3091', type: 'pjsip', name: 'No Outbound PJSIP', companyId, allowOutbound: false },
        })

        expect(res.statusCode).toBe(201)
        expect(res.json().extension.allowOutbound).toBe(false)
    })

    it('201 defaults allowOutbound to true when omitted', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3092', type: 'sip', name: 'Default Outbound', companyId },
        })

        expect(res.statusCode).toBe(201)
        expect(res.json().extension.allowOutbound).toBe(true)
    })

    it('200 updates allowOutbound via PUT', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: `/extensions/${sipId}`,
            headers: auth(),
            body: { allowOutbound: false },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json().extension.allowOutbound).toBe(false)
    })
})

// ---------------------------------------- DELETE /extensions/:id
describe('DELETE /extensions/:id', () => {
    it('200 deletes extension sip', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3080', type: 'sip', name: 'Del', companyId },
        })
        const id = created.json().extension.id

        const res = await app.inject({
            method: 'DELETE',
            url: `/extensions/${id}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(await prisma.extension.findUnique({ where: { id } })).toBeNull()
    })

    it('200 deletes extension pjsip', async () => {
        const created = await app.inject({
            method: 'POST',
            url: '/extensions',
            headers: auth(),
            body: { alias: '3081', type: 'pjsip', name: 'Del', companyId },
        })
        const id = created.json().extension.id

        const res = await app.inject({
            method: 'DELETE',
            url: `/extensions/${id}`,
            headers: auth(),
        })

        expect(res.statusCode).toBe(200)
        expect(await prisma.extension.findUnique({ where: { id } })).toBeNull()
    })

    it('404 with non-existent id', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/extensions/clxxxxxxxxxxxxxxxxxxxxxxxxx',
            headers: auth(),
        })

        expect(res.statusCode).toBe(404)
    })

    it('401 without token', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/extensions/${sipId}`,
        })

        expect(res.statusCode).toBe(401)
    })
})
