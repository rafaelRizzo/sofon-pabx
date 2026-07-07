import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../../../lib/jwt', () => ({
    generateTokens: mock(() => Promise.resolve({ token: 'access-token', refreshToken: 'refresh-token', refreshJti: 'jti-2' })),
    verifyRefreshToken: mock(() => ({ id: 'user-id', role: 'admin', jti: 'jti-1', type: 'refresh' })),
}))
mock.module('../../../lib/jti', () => ({
    jtiManager: {
        exists: mock(() => Promise.resolve(true)),
        revoke: mock(() => Promise.resolve()),
        add: mock(() => Promise.resolve()),
    },
}))

import * as AuthService from '../auth.service'
import argon2 from 'argon2'

const HASHED = await argon2.hash('correct-password')

beforeEach(() => {
    clearPrismaMock(db)
})

// ─── login ────────────────────────────────────────────────────────────────────
describe('AuthService.login', () => {
    it('returns tokens with valid credentials', async () => {
        db.user.findUnique.mockResolvedValue({ id: 'u1', password: HASHED, role: 'admin', status: 'active' })
        const result = await AuthService.login({ username: 'admin@test.com', password: 'correct-password' })
        expect(result).toHaveProperty('token')
        expect(result).toHaveProperty('refreshToken')
    })

    it('throws 401 with wrong password', async () => {
        db.user.findUnique.mockResolvedValue({ id: 'u1', password: HASHED, role: 'admin', status: 'active' })
        await expect(AuthService.login({ username: 'admin@test.com', password: 'wrong' }))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    it('throws 401 with non-existent username', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(AuthService.login({ username: 'none@test.com', password: 'x' }))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    it('throws 403 with inactive user', async () => {
        db.user.findUnique.mockResolvedValue({ id: 'u1', password: HASHED, role: 'admin', status: 'inactive' })
        await expect(AuthService.login({ username: 'admin@test.com', password: 'correct-password' }))
            .rejects.toMatchObject({ statusCode: 403 })
    })
})

// ─── register ─────────────────────────────────────────────────────────────────
describe('AuthService.register', () => {
    it('throws 403 when users already exist', async () => {
        db.user.count.mockResolvedValue(1)
        await expect(AuthService.register({ name: 'X', username: 'x@test.com', password: 'abc123' }))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('creates admin user when no users exist', async () => {
        db.user.count.mockResolvedValue(0)
        db.user.findUnique.mockResolvedValue(null)
        db.user.create.mockResolvedValue({ id: 'u1', role: 'admin' })
        const result = await AuthService.register({ name: 'Admin', username: 'admin@test.com', password: 'abc123' })
        expect(result).toHaveProperty('token')
    })
})

// ─── refreshAccessToken ───────────────────────────────────────────────────────
describe('AuthService.refreshAccessToken', () => {
    it('returns new tokens with valid refresh token', async () => {
        db.user.findUnique.mockResolvedValue({ id: 'user-id', status: 'active', role: 'admin' })
        const result = await AuthService.refreshAccessToken('valid-refresh-token')
        expect(result).toHaveProperty('token')
        expect(result).toHaveProperty('refreshToken')
    })

    it('throws 401 with invalid refresh token', async () => {
        const { verifyRefreshToken } = await import('../../../lib/jwt')
            ; (verifyRefreshToken as any).mockImplementationOnce(() => { throw new Error('invalid') })
        await expect(AuthService.refreshAccessToken('bad-token'))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    it('throws 401 when user not found', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(AuthService.refreshAccessToken('valid-refresh-token'))
            .rejects.toMatchObject({ statusCode: 401 })
    })
})
