import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as UsersService from '../users.service'

type UserRow = { id: string; name: string; username: string; role: string; status: string }

const PREFIX = `__test_users_svc_${Date.now()}__`

let userId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: {
            name: 'Seed User',
            username: `${PREFIX}seed@test.com`,
            password: 'hashed',
        },
    })
    userId = user.id
})

afterAll(async () => {
    await teardownTestEnv(PREFIX)
})

// --------------------------------------------------------- getAllUsers
describe('UsersService.getAllUsers', () => {
    it('retorna lista com pelo menos o usuário criado', async () => {
        const users = await UsersService.getAllUsers() as UserRow[]

        expect(Array.isArray(users)).toBe(true)
        expect(users.some((u) => u.id === userId)).toBe(true)
    })

    it('não expõe campo password', async () => {
        const users = await UsersService.getAllUsers() as UserRow[]
        expect((users[0] as any).password).toBeUndefined()
    })
})

// -------------------------------------------------------- getUserById
describe('UsersService.getUserById', () => {
    it('retorna o usuário pelo id', async () => {
        const user = await UsersService.getUserById(userId) as UserRow

        expect(user.id).toBe(userId)
        expect(user.username).toBe(`${PREFIX}seed@test.com`)
        expect((user as any).password).toBeUndefined()
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            UsersService.getUserById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------------- createUser
describe('UsersService.createUser', () => {
    it('cria usuário com senha hasheada', async () => {
        const email = `${PREFIX}create@test.com`

        const user = await UsersService.createUser({
            name: 'Created',
            username: email,
            password: 'plain-password',
        })

        expect(user.username).toBe(email)
        expect((user as any).password).toBeUndefined()

        const raw = await prisma.user.findUnique({ where: { username: email } })
        expect(raw?.password).not.toBe('plain-password')
    })
})

// --------------------------------------------------------- updateUser
describe('UsersService.updateUser', () => {
    it('atualiza nome do usuário', async () => {
        const user = await UsersService.updateUser(userId, { name: 'Updated Name' })

        expect(user.name).toBe('Updated Name')
    })

    it('re-hasheia quando password é atualizado', async () => {
        await UsersService.updateUser(userId, { password: 'new-password-456' })

        const raw = await prisma.user.findUnique({ where: { id: userId } })
        expect(raw?.password).not.toBe('new-password-456')
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            UsersService.updateUser('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------- getCompaniesByUser
describe('UsersService.getCompaniesByUser', () => {
    it('retorna lista vazia para usuário sem empresas', async () => {
        const companies = await UsersService.getCompaniesByUser(userId) as any[]

        expect(Array.isArray(companies)).toBe(true)
        expect(companies).toHaveLength(0)
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            UsersService.getCompaniesByUser('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// --------------------------------------------------------- deleteUser
describe('UsersService.deleteUser', () => {
    it('deleta o usuário', async () => {
        const toDelete = await prisma.user.create({
            data: {
                name: 'To Delete',
                username: `${PREFIX}delete@test.com`,
                password: 'x',
            },
        })

        await UsersService.deleteUser(toDelete.id)

        const check = await prisma.user.findUnique({ where: { id: toDelete.id } })
        expect(check).toBeNull()
    })
})
