import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../cache/companies.cache', () => ({
    CompaniesCache: { getAllCompanies: mock(() => null), setAllCompanies: mock(), getCompany: mock(() => null), setCompany: mock(), invalidateCompany: mock(), invalidateAllCompanies: mock(), getCompaniesByUser: mock(() => null), setCompaniesByUser: mock(), invalidateCompaniesByUser: mock() },
}))
mock.module('../../extensions/cache/extensions.cache', () => ({
    ExtensionsCache: { invalidateAllExtensions: mock() },
}))
mock.module('../../queues/cache/queues.cache', () => ({
    QueuesCache: { invalidateNamespace: mock() },
}))
mock.module('../../../asterisk/pjsip.repository', () => ({
    PjsipRepository: { deleteManyByIds: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/sip.repository', () => ({
    SipRepository: { deleteManyByNames: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/queue.repository', () => ({
    AsteriskQueueRepository: { removeMembersByInterfaces: mock(() => Promise.resolve()), deleteManyQueues: mock(() => Promise.resolve()) },
}))

import * as CompaniesService from '../companies.service'

const COMPANY = { id: 'c1', name: 'ACME', doc: null, asteriskId: 'ast1', timezone: 'America/Sao_Paulo', metadata: {}, createdAt: new Date(), updatedAt: new Date() }
const USER = { id: 'u1', name: 'Admin', username: 'admin@test.com' }

beforeEach(() => clearPrismaMock(db))

// ─── getAllCompanies ───────────────────────────────────────────────────────────
describe('CompaniesService.getAllCompanies', () => {
    it('returns list of companies', async () => {
        db.company.findMany.mockResolvedValue([COMPANY])
        const companies = await CompaniesService.getAllCompanies() as any[]
        expect(companies[0].id).toBe('c1')
    })

    it('returns empty array when companyIds is empty', async () => {
        const companies = await CompaniesService.getAllCompanies([])
        expect(companies).toHaveLength(0)
    })
})

// ─── getCompanyById ───────────────────────────────────────────────────────────
describe('CompaniesService.getCompanyById', () => {
    it('returns company by id', async () => {
        db.company.findUnique.mockResolvedValue(COMPANY)
        const company = await CompaniesService.getCompanyById('c1') as any
        expect(company.id).toBe('c1')
    })

    it('throws 404 with non-existent id', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.getCompanyById('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})

// ─── createCompany ────────────────────────────────────────────────────────────
describe('CompaniesService.createCompany', () => {
    it('creates company and links user', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.company.create.mockResolvedValue(COMPANY)
        db.userCompany.create.mockResolvedValue({})
        const company = await CompaniesService.createCompany({ name: 'ACME', userId: 'u1', metadata: {} }) as any
        expect(company.id).toBe('c1')
    })

    it('throws 404 with non-existent userId', async () => {
        db.user.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.createCompany({ name: 'X', userId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', metadata: {} }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('passes timezone through to prisma when provided', async () => {
        db.user.findUnique.mockResolvedValue(USER)
        db.company.create.mockResolvedValue({ ...COMPANY, timezone: 'Europe/Lisbon' })
        db.userCompany.create.mockResolvedValue({})
        await CompaniesService.createCompany({ name: 'ACME', userId: 'u1', metadata: {}, timezone: 'Europe/Lisbon' })
        expect(db.company.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ timezone: 'Europe/Lisbon' }),
        }))
    })
})

// ─── updateCompany ────────────────────────────────────────────────────────────
describe('CompaniesService.updateCompany', () => {
    it('updates company', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [] })
        db.company.update.mockResolvedValue({ ...COMPANY, name: 'Updated' })
        const company = await CompaniesService.updateCompany('c1', { name: 'Updated' }) as any
        expect(company.name).toBe('Updated')
    })

    it('throws 404 with non-existent id', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.updateCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx', { name: 'X' }))
            .rejects.toMatchObject({ statusCode: 404 })
    })

    it('updates timezone', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [] })
        db.company.update.mockResolvedValue({ ...COMPANY, timezone: 'Europe/Lisbon' })
        const company = await CompaniesService.updateCompany('c1', { timezone: 'Europe/Lisbon' }) as any
        expect(company.timezone).toBe('Europe/Lisbon')
        expect(db.company.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { timezone: 'Europe/Lisbon' },
        }))
    })
})

// ─── deleteCompany ────────────────────────────────────────────────────────────
describe('CompaniesService.deleteCompany', () => {
    it('deletes company', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [{ userId: 'u1' }] })
        db.extension.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([])
        db.trunk.findMany.mockResolvedValue([])
        db.extension.deleteMany.mockResolvedValue({ count: 0 })
        db.company.delete.mockResolvedValue(COMPANY)
        await CompaniesService.deleteCompany('c1')
        expect(db.company.delete).toHaveBeenCalled()
    })

    it('throws 404 with non-existent id', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.deleteCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
