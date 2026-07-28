import { mock, describe, it, expect, beforeEach } from 'bun:test'
import { createPrismaMock, clearPrismaMock } from '../../../test/mocks/prisma.mock'

const db = createPrismaMock()

mock.module('../../../lib/prisma', () => ({ prisma: db }))
mock.module('../cache/companies.cache', () => ({
    CompaniesCache: { getAllCompanies: mock(() => null), setAllCompanies: mock(), getCompany: mock(() => null), setCompany: mock(), invalidateCompany: mock(), invalidateAllCompanies: mock(), getCompaniesByUser: mock(() => null), setCompaniesByUser: mock(), invalidateCompaniesByUser: mock(), getCompaniesForScope: mock(() => null), setCompaniesForScope: mock(), invalidateCompaniesForScope: mock() },
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
    AsteriskQueueRepository: {
        removeMembersByInterfaces: mock(() => Promise.resolve()),
        deleteManyQueues: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: {
        deleteMany: mock(() => Promise.resolve()),
        regenerateAll: mock(() => Promise.resolve()),
    },
}))
mock.module('../../../asterisk/dialplan-file.repository', () => ({
    removeCompanyDialplanFiles: mock(() => Promise.resolve()),
}))
mock.module('../../holiday-groups/cache/holiday-groups.cache', () => ({
    HolidayGroupsCache: { invalidateNamespace: mock() },
}))
mock.module('../../announcements/cache/announcements.cache', () => ({
    AnnouncementsCache: { invalidateNamespace: mock() },
}))
mock.module('../../ivr/cache/ivr.cache', () => ({
    IvrCache: { invalidateNamespace: mock() },
}))
mock.module('../../../asterisk/audio.repository', () => ({
    audioSoundDir: (asteriskId: string) => `/var/lib/asterisk/sounds/${asteriskId}`,
}))
mock.module('../../audios/cache/audios.cache', () => ({
    AudiosCache: { invalidateNamespace: mock() },
}))
mock.module('../../request-templates/cache/request-templates.cache', () => ({
    RequestTemplatesCache: { invalidateNamespace: mock() },
}))
mock.module('fs/promises', () => ({ rm: mock(() => Promise.resolve()) }))

import * as CompaniesService from '../companies.service'
import { AsteriskQueueRepository } from '../../../asterisk/queue.repository'
import { InboundRouteRepository } from '../../../asterisk/inboundroute.repository'
import { removeCompanyDialplanFiles } from '../../../asterisk/dialplan-file.repository'

const COMPANY = { id: 'c1', name: 'ACME', doc: null, asteriskId: 'ast1', timezone: 'America/Sao_Paulo', metadata: {}, createdAt: new Date(), updatedAt: new Date() }

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
    it('creates company and links the creating user', async () => {
        db.company.create.mockResolvedValue(COMPANY)
        db.userCompany.create.mockResolvedValue({})
        const company = await CompaniesService.createCompany({ name: 'ACME', metadata: {} }, 'u1') as any
        expect(company.id).toBe('c1')
        expect(db.userCompany.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { userId: 'u1', companyId: 'c1' },
        }))
    })

    it('passes timezone through to prisma when provided', async () => {
        db.company.create.mockResolvedValue({ ...COMPANY, timezone: 'Europe/Lisbon' })
        db.userCompany.create.mockResolvedValue({})
        await CompaniesService.createCompany({ name: 'ACME', metadata: {}, timezone: 'Europe/Lisbon' }, 'u1')
        expect(db.company.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ timezone: 'Europe/Lisbon' }),
        }))
    })

    it('throws 409 when name+doc already exists', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, doc: '12345678900' })
        await expect(CompaniesService.createCompany({ name: 'ACME', doc: '12345678900', metadata: {} }, 'u1'))
            .rejects.toMatchObject({ statusCode: 409 })
        expect(db.company.create).not.toHaveBeenCalled()
    })

    it('allows create without doc even if name is duplicated', async () => {
        db.company.create.mockResolvedValue(COMPANY)
        db.userCompany.create.mockResolvedValue({})
        await CompaniesService.createCompany({ name: 'ACME', metadata: {} }, 'u1')
        expect(db.company.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { name_doc: expect.anything() } }))
        expect(db.company.create).toHaveBeenCalled()
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

    it('throws 409 when updated name+doc collides with another company', async () => {
        db.company.findUnique
            .mockResolvedValueOnce({ ...COMPANY, doc: '12345678900', users: [] })
            .mockResolvedValueOnce({ ...COMPANY, id: 'c2', doc: '12345678900' })
        await expect(CompaniesService.updateCompany('c1', { name: 'Renamed' }))
            .rejects.toMatchObject({ statusCode: 409 })
        expect(db.company.update).not.toHaveBeenCalled()
    })

    it('allows update when name+doc collides only with itself', async () => {
        db.company.findUnique
            .mockResolvedValueOnce({ ...COMPANY, doc: '12345678900', users: [] })
            .mockResolvedValueOnce({ ...COMPANY, doc: '12345678900' })
        db.company.update.mockResolvedValue({ ...COMPANY, name: 'Renamed', doc: '12345678900' })
        const company = await CompaniesService.updateCompany('c1', { name: 'Renamed' }) as any
        expect(company.name).toBe('Renamed')
    })
})

// ─── deleteCompany ────────────────────────────────────────────────────────────
describe('CompaniesService.deleteCompany', () => {
    it('deletes company', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [{ userId: 'u1' }] })
        db.extension.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([])
        db.trunk.findMany.mockResolvedValue([])
        db.inboundRoute.findMany.mockResolvedValue([])
        db.outboundDialPattern.findMany.mockResolvedValue([])
        db.extension.deleteMany.mockResolvedValue({ count: 0 })
        db.company.delete.mockResolvedValue(COMPANY)
        await CompaniesService.deleteCompany('c1')
        expect(db.company.delete).toHaveBeenCalled()
        expect(removeCompanyDialplanFiles).toHaveBeenCalledWith('ast1', expect.any(Array))
    })

    it('cleans up orphaned Asterisk dialplan for queues, inbound routes and outbound patterns', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [] })
        db.extension.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([{ id: 'q1', number: '100' }])
        db.trunk.findMany.mockResolvedValue([])
        db.inboundRoute.findMany.mockResolvedValue([{ trunkId: 't1', did: { number: '5511999998888' } }])
        db.outboundDialPattern.findMany.mockResolvedValue([{ pattern: '_0.' }])
        db.extension.deleteMany.mockResolvedValue({ count: 0 })
        db.extensions.deleteMany.mockResolvedValue({ count: 0 })
        db.company.delete.mockResolvedValue(COMPANY)

        await CompaniesService.deleteCompany('c1')

        expect(AsteriskQueueRepository.deleteManyQueues).toHaveBeenCalledWith(expect.anything(), ['q1'], ['ast1-100'])
        expect(InboundRouteRepository.deleteMany).toHaveBeenCalledWith(expect.anything(), [{ trunkId: 't1', didNumber: '5511999998888' }])
        expect(db.extensions.deleteMany).toHaveBeenCalledWith({ where: { context: 'ramais', exten: { in: ['_0.'] } } })
        expect(removeCompanyDialplanFiles).toHaveBeenCalledWith('ast1', expect.any(Array))
    })

    it('throws 404 with non-existent id', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.deleteCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
