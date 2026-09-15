import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../cache/users.cache', () => ({
    UsersCache: { getAllUsers: mock(() => null), setAllUsers: mock(), getUser: mock(() => null), setUser: mock(), invalidateUser: mock(), invalidateAllUsers: mock() },
}))
mock.module('../../companies/cache/companies.cache', () => ({
    CompaniesCache: { getCompaniesByUser: mock(() => null), setCompaniesByUser: mock(), invalidateCompaniesByUser: mock() },
}))
mock.module('../../../lib/jti', () => ({
    jtiManager: { revokeByUserId: mock(() => Promise.resolve()) },
}))

import * as UsersService from '../users.service'

const USER = { id: 'u1', name: 'Test', username: 'test@test.com', role: 'user', status: 'active', extensionId: null, createdBy: null, webhookSlug: 'slug', companies: [], createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => clearPrismaMock(db))

// ─── getAllUsers ───────────────────────────────────────────────────────────────
describe('UsersService.getAllUsers', () => {
    it('returns list of users', async () => {
        db.user.findMany.mockResolvedValue([USER])
        const users = await UsersService.getAllUsers()
        expect(Array.isArray(users)).toBe(true)
        expect((users as any[])[0].id).toBe('u1')
    })

    it('does not expose password field', async () => {
        db.user.findMany.mockResolvedValue([USER])
        const users = await UsersService.getAllUsers() as any[]
        expect(users[0].password).toBeUndefined()
    })
})

// ─── getUserById ──────────────────────────────────────────────────────────────
describe('UsersService.getUserById', () => {
    it('returns user by id', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        const user = await UsersService.getUserById('u1') as any
        expect(user.id).toBe('u1')
    })

    it('throws 404 with non-existent id', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(UsersService.getUserById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createUser ───────────────────────────────────────────────────────────────
describe('UsersService.createUser', () => {
    it('creates user with default role', async () => {
        db.user.findUnique.mockResolvedValue(null)
        db.company.count.mockResolvedValue(1)
        db.user.create.mockResolvedValue({ id: 'u1' })
        db.user.findUniqueOrThrow.mockResolvedValue({ ...USER, role: 'user' })
        const user = await UsersService.createUser({ name: 'New', username: 'new@test.com', password: 'abc123', companyIds: ['c1'] }) as any
        expect(user.role).toBe('user')
    })

    it('throws 409 on duplicate username', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        await expect(UsersService.createUser({ name: 'Dup', username: 'test@test.com', password: 'x', companyIds: ['c1'] }))
            .rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 when a company does not exist', async () => {
        db.user.findUnique.mockResolvedValue(null)
        db.company.count.mockResolvedValue(0)
        await expect(UsersService.createUser({ name: 'New', username: 'new2@test.com', password: 'abc123', companyIds: ['missing'] }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('sets createdBy when provided', async () => {
        db.user.findUnique.mockResolvedValue(null)
        db.company.count.mockResolvedValue(1)
        db.user.create.mockResolvedValue({ id: 'u1' })
        db.user.findUniqueOrThrow.mockResolvedValue({ ...USER, createdBy: 'creator-id' })
        const user = await UsersService.createUser({ name: 'Child', username: 'child@test.com', password: 'x', companyIds: ['c1'] }, 'creator-id') as any
        expect(user.createdBy).toBe('creator-id')
    })
})

// ─── updateUser ───────────────────────────────────────────────────────────────
describe('UsersService.updateUser', () => {
    it('updates user', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.user.findUniqueOrThrow.mockResolvedValue({ ...USER, name: 'Updated' })
        const user = await UsersService.updateUser('u1', { name: 'Updated' })
        expect(user.name).toBe('Updated')
    })

    it('throws 404 with non-existent id', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(UsersService.updateUser('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('revokes existing sessions when the password changes', async () => {
        const { jtiManager } = await import('../../../lib/jti')
        db.user.findUnique.mockResolvedValue(USER)
        db.user.findUniqueOrThrow.mockResolvedValue(USER)
        await UsersService.updateUser('u1', { password: 'new-secret' })
        expect(jtiManager.revokeByUserId).toHaveBeenCalledWith('u1')
    })
})

// ─── getCompaniesByUser ───────────────────────────────────────────────────────
describe('UsersService.getCompaniesByUser', () => {
    it('returns companies for user', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.company.findMany.mockResolvedValue([])
        const companies = await UsersService.getCompaniesByUser('u1')
        expect(Array.isArray(companies)).toBe(true)
    })

    it('throws 404 with non-existent id', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(UsersService.getCompaniesByUser('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── deleteUser ───────────────────────────────────────────────────────────────
describe('UsersService.deleteUser', () => {
    it('deletes user', async () => {
        db.user.delete.mockResolvedValue(USER)
        await UsersService.deleteUser('u1')
        expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
        const { jtiManager } = await import('../../../lib/jti')
        expect(jtiManager.revokeByUserId).toHaveBeenCalledWith('u1')
    })
})
