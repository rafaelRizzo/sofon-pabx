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
    AsteriskQueueRepository: {
        removeMembersByInterfaces: mock(() => Promise.resolve()),
        deleteManyQueues: mock(() => Promise.resolve()),
        removeManyQueueAppEntries: mock(() => Promise.resolve()),
    },
    queueAppExten: (asteriskId: string, number: string) => `${asteriskId}-${number}`,
}))
mock.module('../../../asterisk/inboundroute.repository', () => ({
    InboundRouteRepository: { deleteMany: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/timecondition.repository', () => ({
    TimeConditionRepository: { deleteManyByIds: mock(() => Promise.resolve()) },
}))
mock.module('../../../asterisk/holidaygroup.repository', () => ({
    HolidayGroupRepository: { deleteManyByIds: mock(() => Promise.resolve()) },
}))
mock.module('../../holiday-groups/cache/holiday-groups.cache', () => ({
    HolidayGroupsCache: { invalidateNamespace: mock() },
}))
mock.module('../../../asterisk/announcement.repository', () => ({
    AnnouncementRepository: { removeManyByIds: mock(() => Promise.resolve()) },
}))
mock.module('../../announcements/cache/announcements.cache', () => ({
    AnnouncementsCache: { invalidateNamespace: mock() },
}))
mock.module('../../../asterisk/ivr.repository', () => ({
    IvrRepository: { removeManyByIds: mock(() => Promise.resolve()) },
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
mock.module('../../../asterisk/request-template.repository', () => ({
    RequestTemplateRepository: { removeManyByIds: mock(() => Promise.resolve()) },
}))
mock.module('../../request-templates/cache/request-templates.cache', () => ({
    RequestTemplatesCache: { invalidateNamespace: mock() },
}))
mock.module('fs/promises', () => ({ rm: mock(() => Promise.resolve()) }))

import * as CompaniesService from '../companies.service'
import { AsteriskQueueRepository } from '../../../asterisk/queue.repository'
import { InboundRouteRepository } from '../../../asterisk/inboundroute.repository'
import { TimeConditionRepository } from '../../../asterisk/timecondition.repository'
import { HolidayGroupRepository } from '../../../asterisk/holidaygroup.repository'
import { AnnouncementRepository } from '../../../asterisk/announcement.repository'
import { IvrRepository } from '../../../asterisk/ivr.repository'
import { RequestTemplateRepository } from '../../../asterisk/request-template.repository'

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
        db.inboundRoute.findMany.mockResolvedValue([])
        db.timeCondition.findMany.mockResolvedValue([])
        db.holidayGroup.findMany.mockResolvedValue([])
        db.outboundDialPattern.findMany.mockResolvedValue([])
        db.announcement.findMany.mockResolvedValue([])
        db.ivrMenu.findMany.mockResolvedValue([])
        db.requestTemplate.findMany.mockResolvedValue([])
        db.extension.deleteMany.mockResolvedValue({ count: 0 })
        db.company.delete.mockResolvedValue(COMPANY)
        await CompaniesService.deleteCompany('c1')
        expect(db.company.delete).toHaveBeenCalled()
    })

    it('cleans up orphaned Asterisk dialplan for queues-app, inbound routes, time conditions and outbound patterns', async () => {
        db.company.findUnique.mockResolvedValue({ ...COMPANY, users: [] })
        db.extension.findMany.mockResolvedValue([])
        db.queue.findMany.mockResolvedValue([{ name: 'suporte', number: '100' }])
        db.trunk.findMany.mockResolvedValue([])
        db.inboundRoute.findMany.mockResolvedValue([{ trunkId: 't1', did: { number: '5511999998888' } }])
        db.timeCondition.findMany.mockResolvedValue([{ id: 'tc1' }])
        db.holidayGroup.findMany.mockResolvedValue([{ id: 'hol1' }])
        db.outboundDialPattern.findMany.mockResolvedValue([{ pattern: '_0.' }])
        db.announcement.findMany.mockResolvedValue([{ id: 'ann1' }])
        db.ivrMenu.findMany.mockResolvedValue([{ id: 'ivr1' }])
        db.requestTemplate.findMany.mockResolvedValue([{ id: 'reqtpl1' }])
        db.extension.deleteMany.mockResolvedValue({ count: 0 })
        db.extensions.deleteMany.mockResolvedValue({ count: 0 })
        db.company.delete.mockResolvedValue(COMPANY)

        await CompaniesService.deleteCompany('c1')

        expect(AsteriskQueueRepository.removeManyQueueAppEntries).toHaveBeenCalledWith(expect.anything(), ['ast1-100'])
        expect(InboundRouteRepository.deleteMany).toHaveBeenCalledWith(expect.anything(), [{ trunkId: 't1', didNumber: '5511999998888' }])
        expect(TimeConditionRepository.deleteManyByIds).toHaveBeenCalledWith(expect.anything(), ['tc1'])
        expect(HolidayGroupRepository.deleteManyByIds).toHaveBeenCalledWith(expect.anything(), ['hol1'])
        expect(AnnouncementRepository.removeManyByIds).toHaveBeenCalledWith(expect.anything(), ['ann1'])
        expect(IvrRepository.removeManyByIds).toHaveBeenCalledWith(expect.anything(), ['ivr1'])
        expect(RequestTemplateRepository.removeManyByIds).toHaveBeenCalledWith(expect.anything(), ['reqtpl1'])
        expect(db.extensions.deleteMany).toHaveBeenCalledWith({ where: { context: 'ramais', exten: { in: ['_0.'] } } })
    })

    it('throws 404 with non-existent id', async () => {
        db.company.findUnique.mockResolvedValue(null)
        await expect(CompaniesService.deleteCompany('clxxxxxxxxxxxxxxxxxxxxxxxxx'))
            .rejects.toMatchObject({ statusCode: 404 })
    })
})
