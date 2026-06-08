import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../../lib/prisma'
import { setupTestEnv, teardownTestEnv } from '../../../test/setup'
import * as CompaniesService from '../companies.service'

const PREFIX = `__test_companies_svc_${Date.now()}__`

let userId: string
let companyId: string

beforeAll(async () => {
    await setupTestEnv()

    const user = await prisma.user.create({
        data: {
            name: 'Test User',
            username: `${PREFIX}@test.com`,
            password: 'hashed',
            role: 'admin',
        },
    })
    userId = user.id
})

afterAll(async () => {
    await prisma.userCompany.deleteMany({ where: { userId } })
    await prisma.company.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await teardownTestEnv(PREFIX)
})

// -------------------------------------------------------- createCompany
describe('CompaniesService.createCompany', () => {
    it('cria empresa e vínculo com usuário', async () => {
        const company = await CompaniesService.createCompany({
            name: `${PREFIX} Speed SP`,
            userId,
            metadata: {},
        })

        companyId = company.id

        expect(company.name).toBe(`${PREFIX} Speed SP`)
        expect(company.id).toBeTruthy()

        const link = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId: company.id } },
        })
        expect(link).not.toBeNull()
    })

    it('throws 404 com userId inexistente', async () => {
        await expect(
            CompaniesService.createCompany({
                name: `${PREFIX} Fail`,
                userId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
                metadata: {},
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------------- getAllCompanies
describe('CompaniesService.getAllCompanies', () => {
    it('retorna lista com pelo menos a empresa criada', async () => {
        const companies = await CompaniesService.getAllCompanies() as any[]

        expect(Array.isArray(companies)).toBe(true)
        expect(companies.some((c) => c.id === companyId)).toBe(true)
    })

    it('não expõe campo users', async () => {
        const companies = await CompaniesService.getAllCompanies() as any[]
        const company = companies.find((c) => c.id === companyId)
        expect(company?.users).toBeUndefined()
    })
})

// ----------------------------------------------------- getCompanyById
describe('CompaniesService.getCompanyById', () => {
    it('retorna empresa pelo id', async () => {
        const company = await CompaniesService.getCompanyById(companyId) as any

        expect(company.id).toBe(companyId)
        expect(company.name).toBe(`${PREFIX} Speed SP`)
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            CompaniesService.getCompanyById('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------------ updateCompany
describe('CompaniesService.updateCompany', () => {
    it('atualiza nome da empresa', async () => {
        const updated = await CompaniesService.updateCompany(companyId, {
            name: `${PREFIX} Speed RJ`,
        })

        expect(updated.name).toBe(`${PREFIX} Speed RJ`)
    })

    it('atualiza metadata', async () => {
        const updated = await CompaniesService.updateCompany(companyId, {
            metadata: { city: 'Sao Paulo' },
        })

        expect((updated.metadata as any).city).toBe('Sao Paulo')
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            CompaniesService.updateCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' })
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})

// ------------------------------------------------------ deleteCompany
describe('CompaniesService.deleteCompany', () => {
    it('deleta empresa e vínculo', async () => {
        const toDelete = await CompaniesService.createCompany({
            name: `${PREFIX} To Delete`,
            userId,
            metadata: {},
        })

        await CompaniesService.deleteCompany(toDelete.id)

        const check = await prisma.company.findUnique({ where: { id: toDelete.id } })
        expect(check).toBeNull()

        const link = await prisma.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId: toDelete.id } },
        })
        expect(link).toBeNull()
    })

    it('throws 404 com id inexistente', async () => {
        await expect(
            CompaniesService.deleteCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx')
        ).rejects.toMatchObject({ statusCode: 404 })
    })
})
