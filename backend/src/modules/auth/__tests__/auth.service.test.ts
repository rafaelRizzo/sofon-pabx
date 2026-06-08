import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as AuthService from '../auth.service'
import argon2 from 'argon2'

const PREFIX = `__test_auth_svc_${Date.now()}__`
const EMAIL = `${PREFIX}@test.com`
const PASSWORD = 'test-password-123'

beforeAll(async () => {
    await setupTestEnv()
    await prisma.user.create({
        data: {
            name: 'Test User',
            username: EMAIL,
            password: await argon2.hash(PASSWORD),
        },
    })
})

afterAll(async () => {
    await teardownTestEnv(PREFIX)
})

// --------------------------------------------------------------------- login
describe('AuthService.login', () => {
    it('retorna tokens com credenciais válidas', async () => {
        const result = await AuthService.login({ username: EMAIL, password: PASSWORD })

        expect(result).toHaveProperty('token')
        expect(result).toHaveProperty('refreshToken')
        expect(typeof result.token).toBe('string')
    })

    it('throws 401 com senha errada', async () => {
        await expect(
            AuthService.login({ username: EMAIL, password: 'wrong-password' })
        ).rejects.toMatchObject({ statusCode: 401 })
    })

    it('throws 401 com username inexistente', async () => {
        await expect(
            AuthService.login({ username: 'nao-existe@test.com', password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 401 })
    })

    it('throws 403 com usuário inativo', async () => {
        const inactiveEmail = `${PREFIX}_inactive@test.com`
        await prisma.user.create({
            data: {
                name: 'Inactive',
                username: inactiveEmail,
                password: await argon2.hash(PASSWORD),
                status: 'inactive',
            },
        })

        await expect(
            AuthService.login({ username: inactiveEmail, password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 403 })
    })
})

// ------------------------------------------------------------------ register
describe('AuthService.register', () => {
    it('throws 403 quando já existe um usuário no sistema', async () => {
        await expect(
            AuthService.register({ name: 'New User', username: `${PREFIX}_new@test.com`, password: PASSWORD })
        ).rejects.toMatchObject({ statusCode: 403 })
    })
})

// --------------------------------------------------------- refreshAccessToken
describe('AuthService.refreshAccessToken', () => {
    it('retorna novos tokens com refresh token válido', async () => {
        const { refreshToken } = await AuthService.login({ username: EMAIL, password: PASSWORD })

        const result = await AuthService.refreshAccessToken(refreshToken)

        expect(result).toHaveProperty('token')
        expect(result).toHaveProperty('refreshToken')
    })

    it('throws 401 com refresh token inválido', async () => {
        await expect(
            AuthService.refreshAccessToken('token-invalido')
        ).rejects.toMatchObject({ statusCode: 401 })
    })
})
