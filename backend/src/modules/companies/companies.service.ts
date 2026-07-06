import { rm } from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { CompaniesCache } from './cache/companies.cache'
import { ExtensionsCache } from '../extensions/cache/extensions.cache'
import { QueuesCache } from '../queues/cache/queues.cache'
import { AnnouncementsCache } from '../announcements/cache/announcements.cache'
import { IvrCache } from '../ivr/cache/ivr.cache'
import { AudiosCache } from '../audios/cache/audios.cache'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { SipRepository } from '../../asterisk/sip.repository'
import { AsteriskQueueRepository, queueAppExten } from '../../asterisk/queue.repository'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { HolidayGroupRepository } from '../../asterisk/holidaygroup.repository'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { audioSoundDir } from '../../asterisk/audio.repository'
import { RequestTemplateRepository } from '../../asterisk/request-template.repository'
import { RequestTemplatesCache } from '../request-templates/cache/request-templates.cache'
import { HolidayGroupsCache } from '../holiday-groups/cache/holiday-groups.cache'
import type { CreateCompanyInput, UpdateCompanyInput } from './schemas/company.schema'
import { AppError } from '../../utils/errors/app.error'

const companySelect = {
    id: true,
    name: true,
    doc: true,
    asteriskId: true,
    timezone: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.company.findUnique({ where: { id: '' }, select: companySelect })
export type CompanyDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

export const getAllCompanies = async (companyIds?: string[]) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await CompaniesCache.getAllCompanies()
        if (cached) return cached
    }

    const companies = await prisma.company.findMany({
        where: companyIds ? { id: { in: companyIds } } : undefined,
        select: companySelect,
    })

    if (!companyIds) await CompaniesCache.setAllCompanies(companies)
    return companies
}

export const getCompanyById = async (id: string): Promise<CompanyDto> => {
    const cached = await CompaniesCache.getCompany<CompanyDto>(id)
    if (cached) return cached

    const company = await prisma.company.findUnique({
        where: { id },
        select: companySelect,
    })

    if (!company) {
        throw new AppError('Company not found', 404)
    }

    await CompaniesCache.setCompany(id, company)
    return company
}

export const createCompany = async ({ userId, ...data }: Omit<CreateCompanyInput, 'userId'> & { userId: string }) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
        throw new AppError('User not found', 404)
    }

    const company = await prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
            data,
            select: companySelect,
        })

        await tx.userCompany.create({
            data: { userId, companyId: created.id },
        })

        return created
    })

    await CompaniesCache.invalidateAllCompanies()
    await CompaniesCache.invalidateCompaniesByUser(userId)
    return company
}

export const updateCompany = async (id: string, data: UpdateCompanyInput) => {
    const existing = await prisma.company.findUnique({
        where: { id },
        include: { users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    const company = await prisma.company.update({
        where: { id },
        data,
        select: companySelect,
    })

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    await Promise.all(existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)))
    return company
}

export const deleteCompany = async (id: string) => {
    const existing = await prisma.company.findUnique({
        where: { id },
        select: { id: true, asteriskId: true, users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    const [extensions, queues, trunks, inboundRoutes, timeConditions, holidayGroups, outboundPatterns, announcements, ivrMenus, requestTemplates] = await Promise.all([
        prisma.extension.findMany({
            where: { companyId: id },
            select: { number: true, type: true },
        }),
        prisma.queue.findMany({
            where: { companyId: id },
            select: { name: true, number: true },
        }),
        prisma.trunk.findMany({
            where: { companyId: id },
            select: { name: true, registrationMode: true },
        }),
        prisma.inboundRoute.findMany({
            where: { companyId: id },
            select: { trunkId: true, did: { select: { number: true } } },
        }),
        prisma.timeCondition.findMany({
            where: { companyId: id },
            select: { id: true },
        }),
        prisma.holidayGroup.findMany({
            where: { companyId: id },
            select: { id: true },
        }),
        prisma.outboundDialPattern.findMany({
            where: { route: { companyId: id } },
            select: { pattern: true },
        }),
        prisma.announcement.findMany({
            where: { companyId: id },
            select: { id: true },
        }),
        prisma.ivrMenu.findMany({
            where: { companyId: id },
            select: { id: true },
        }),
        prisma.requestTemplate.findMany({
            where: { companyId: id },
            select: { id: true },
        }),
    ])

    const pjsipNumbers = extensions.filter((e) => e.type === 'pjsip').map((e) => e.number)
    const sipNumbers = extensions.filter((e) => e.type === 'sip').map((e) => e.number)
    const asteriskInterfaces = extensions.map((e) => `${e.type.toUpperCase()}/${e.number}`)
    const asteriskQueueNames = queues.map((q) => `${existing.asteriskId}-${q.name}`)
    const queueAppExtens = queues.map((q) => queueAppExten(existing.asteriskId, q.number))

    const trunkIds = trunks.map((t) => `${existing.asteriskId}-trunk-${t.name}`)
    const trunkOutboundIds = trunks
        .filter((t) => t.registrationMode === 'outbound')
        .map((t) => `${existing.asteriskId}-trunk-${t.name}`)

    const inboundRoutesForCleanup = inboundRoutes.map((r) => ({ trunkId: r.trunkId, didNumber: r.did.number }))
    const timeConditionIds = timeConditions.map((tc) => tc.id)
    const holidayGroupIds = holidayGroups.map((hg) => hg.id)
    const outboundPatternValues = outboundPatterns.map((p) => p.pattern)
    const announcementIds = announcements.map((a) => a.id)
    const ivrMenuIds = ivrMenus.map((m) => m.id)
    const requestTemplateIds = requestTemplates.map((r) => r.id)

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.removeMembersByInterfaces(tx, asteriskInterfaces)
        await AsteriskQueueRepository.deleteManyQueues(tx, asteriskQueueNames)
        await AsteriskQueueRepository.removeManyQueueAppEntries(tx, queueAppExtens)
        await InboundRouteRepository.deleteMany(tx, inboundRoutesForCleanup)
        await TimeConditionRepository.deleteManyByIds(tx, timeConditionIds)
        await HolidayGroupRepository.deleteManyByIds(tx, holidayGroupIds)
        await AnnouncementRepository.removeManyByIds(tx, announcementIds)
        await IvrRepository.removeManyByIds(tx, ivrMenuIds)
        await RequestTemplateRepository.removeManyByIds(tx, requestTemplateIds)
        if (outboundPatternValues.length > 0)
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: { in: outboundPatternValues } } })
        await PjsipRepository.deleteManyByIds(tx, [...pjsipNumbers, ...trunkIds], trunkOutboundIds)
        await SipRepository.deleteManyByNames(tx, sipNumbers)
        await tx.extension.deleteMany({ where: { companyId: id } })
        await tx.company.delete({ where: { id } })
    })

    // pasta de áudios da empresa — fora do banco, best-effort após o commit
    await rm(audioSoundDir(existing.asteriskId), { recursive: true, force: true })

    await Promise.all([
        CompaniesCache.invalidateCompany(id),
        CompaniesCache.invalidateAllCompanies(),
        ExtensionsCache.invalidateAllExtensions(),
        QueuesCache.invalidateNamespace(),
        AnnouncementsCache.invalidateNamespace(),
        IvrCache.invalidateNamespace(),
        AudiosCache.invalidateNamespace(),
        RequestTemplatesCache.invalidateNamespace(),
        HolidayGroupsCache.invalidateNamespace(),
        ...existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)),
    ])
}
