import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as DidsService from '../dids.service'

const PREFIX = `__test_dids_svc_${Date.now()}__`

let userId: string
let companyId: string
let didId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: { name: 'Test', username: `${PREFIX}@test.com`, password: 'x', role: 'admin' },
    })
    userId = user.id

    const company = await prisma.company.create({
        data: {
            name: `${PREFIX} Company`,
            metadata: {},
            users: { create: { userId } },
        },
    })
    companyId = company.id
})

afterAll(async () => {
    await prisma.did.deleteMany({ where: { companyId } })
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { id: companyId } })
    await teardownTestEnv(PREFIX)
})

// ------------------------------------------------------ createDid
describe('DidsService.createDid', () => {
    it('cria DID vinculado à company', async () => {
        const did = await DidsService.createDid({ number: '551100001111', companyId })
        didId = did.id

        expect(did.number).toBe('551100001111')
        expect(did.companyId).toBe(companyId)
    })

    it('throws 409 com número duplicado na mesma company', async () => {
        await expect(
            DidsService.createDid({ number: '551100001111', companyId })
        ).rejects.toMatchObject({ statusCode: 409 })
    })

    it('throws 404 com companyId inexistente', async () => {
        await expect(
            DidsService.createDid({ number: '999', companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// -------------------------------------------------- getDidsByCompany
describe('DidsService.getDidsByCompany', () => {
    it('retorna lista de DIDs da company', async () => {
        const dids = await DidsService.getDidsByCompany(companyId) as any[]

        expect(Array.isArray(dids)).toBe(true)
        expect(dids.some((d) => d.id === didId)).toBe(true)
    })

    it('throws 404 com companyId inexistente', async () => {
        await expect(
            DidsService.getDidsByCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ----------------------------------------------------- getDidById
describe('DidsService.getDidById', () => {
    it('retorna DID pelo id', async () => {
        const did = await DidsService.getDidById(didId) as any
        expect(did.id).toBe(didId)
        expect(did.number).toBe('551100001111')
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            DidsService.getDidById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------------- updateDid
describe('DidsService.updateDid', () => {
    it('atualiza número do DID', async () => {
        const did = await DidsService.updateDid(didId, { number: '551100009999' })
        expect(did.number).toBe('551100009999')
    })

    it('throws 409 com número já existente na mesma company', async () => {
        const other = await DidsService.createDid({ number: '551100002222', companyId })

        await expect(
            DidsService.updateDid(didId, { number: '551100002222' })
        ).rejects.toMatchObject({ statusCode: 409 })

        await DidsService.deleteDid(other.id)
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            DidsService.updateDid('clxxxxxxxxxxxxxxxxxxxxxxxxx', { number: '123' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------------- deleteDid
describe('DidsService.deleteDid', () => {
    it('deleta DID', async () => {
        const did = await DidsService.createDid({ number: '551100003333', companyId })
        await DidsService.deleteDid(did.id)

        const check = await prisma.did.findUnique({ where: { id: did.id } })
        expect(check).toBeNull()
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            DidsService.deleteDid('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
