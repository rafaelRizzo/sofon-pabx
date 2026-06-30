import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as UsersService from '../users.service'

type UserRow = {
    id: string
    name: string
    username: string
    role: string
    status: string
    createdBy: string | null
}

const PREFIX = `__test_users_svc_${Date.now()}__`

let userId: string
let resellerId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: { name: 'Seed User', username: `${PREFIX}seed@test.com`, password: 'hashed' },
    })
    userId = user.id

    const reseller = await prisma.user.create({
        data: { name: 'Reseller', username: `${PREFIX}reseller@test.com`, password: 'hashed', role: 'reseller' },
    })
    resellerId = reseller.id
})

afterAll(async () => {
    await teardownTestEnv(PREFIX)
})

// --------------------------------------------------------- getAllUsers
describe('UsersService.getAllUsers', () => {
    it('returns all users when no filter', async () => {
        const users = await UsersService.getAllUsers() as UserRow[]
        expect(Array.isArray(users)).toBe(true)
        expect(users.some((u) => u.id === userId)).toBe(true)
    })

    it('does not expose password field', async () => {
        const users = await UsersService.getAllUsers() as UserRow[]
        expect((users[0] as any).password).toBeUndefined()
    })

    it('returns only users created by the reseller when createdBy filter is set', async () => {
        const child = await UsersService.createUser(
            { name: 'Child', username: `${PREFIX}child@test.com`, password: 'pwd123' },
            resellerId,
        )

        const all = await UsersService.getAllUsers() as UserRow[]
        const filtered = await UsersService.getAllUsers({ createdBy: resellerId }) as UserRow[]

        expect(filtered.every((u) => u.createdBy === resellerId)).toBe(true)
        expect(filtered.some((u) => u.id === child.id)).toBe(true)
        expect(filtered.length).toBeLessThan(all.length)
    })
})

// -------------------------------------------------------- getUserById
describe('UsersService.getUserById', () => {
    it('returns the user by id', async () => {
        const user = await UsersService.getUserById(userId) as UserRow
        expect(user.id).toBe(userId)
        expect(user.username).toBe(`${PREFIX}seed@test.com`)
        expect((user as any).password).toBeUndefined()
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            UsersService.getUserById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------------- createUser
describe('UsersService.createUser', () => {
    it('creates user with hashed password and default role', async () => {
        const email = `${PREFIX}create@test.com`
        const user = await UsersService.createUser({
            name: 'Created',
            username: email,
            password: 'plain-password',
        }) as UserRow

        expect(user.username).toBe(email)
        expect(user.role).toBe('user')
        expect(user.createdBy).toBeNull()
        expect((user as any).password).toBeUndefined()

        const raw = await prisma.user.findUnique({ where: { username: email } })
        expect(raw?.password).not.toBe('plain-password')
    })

    it('sets createdBy when reseller creates a user', async () => {
        const user = await UsersService.createUser(
            { name: 'By Reseller', username: `${PREFIX}byreseller@test.com`, password: 'pwd123' },
            resellerId,
        ) as UserRow

        expect(user.createdBy).toBe(resellerId)
    })

    it('throws 409 on duplicate username', async () => {
        await expect(
            UsersService.createUser({ name: 'Dup', username: `${PREFIX}seed@test.com`, password: 'x' })
        ).rejects.toMatchObject({ statusCode: 409 })
    })
})

// --------------------------------------------------------- updateUser
describe('UsersService.updateUser', () => {
    it('updates user name', async () => {
        const user = await UsersService.updateUser(userId, { name: 'Updated Name' })
        expect(user.name).toBe('Updated Name')
    })

    it('re-hashes when password is updated', async () => {
        await UsersService.updateUser(userId, { password: 'new-password-456' })
        const raw = await prisma.user.findUnique({ where: { id: userId } })
        expect(raw?.password).not.toBe('new-password-456')
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            UsersService.updateUser('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------- getCompaniesByUser
describe('UsersService.getCompaniesByUser', () => {
    it('returns empty list for user without companies', async () => {
        const companies = await UsersService.getCompaniesByUser(userId) as any[]
        expect(Array.isArray(companies)).toBe(true)
        expect(companies).toHaveLength(0)
    })

    it('throws 404 with non-existent id', async () => {
        await expect(
            UsersService.getCompaniesByUser('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------------- deleteUser
describe('UsersService.deleteUser', () => {
    it('deletes the user', async () => {
        const toDelete = await prisma.user.create({
            data: { name: 'To Delete', username: `${PREFIX}delete@test.com`, password: 'x' },
        })

        await UsersService.deleteUser(toDelete.id)

        const check = await prisma.user.findUnique({ where: { id: toDelete.id } })
        expect(check).toBeNull()
    })
})
