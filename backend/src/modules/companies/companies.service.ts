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
import { AsteriskQueueRepository, QUEUE_APP_CONTEXT } from '../../asterisk/queue.repository'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { audioSoundDir } from '../../asterisk/audio.repository'
import { removeCompanyDialplanFiles } from '../../asterisk/dialplan-file.repository'
import { TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT } from '../../asterisk/dialplan-names'
import { RequestTemplatesCache } from '../request-templates/cache/request-templates.cache'
import { HolidayGroupsCache } from '../holiday-groups/cache/holiday-groups.cache'

const DIALPLAN_FILE_CONTEXTS = [TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT, QUEUE_APP_CONTEXT]
import type { CreateCompanyInput, UpdateCompanyInput } from './schemas/company.schema'
import { AppError } from '../../utils/errors/app.error'

const companySelect = {
    id: true,
    name: true,
    doc: true,
    status: true,
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

    if (data.doc) {
        const existing = await prisma.company.findUnique({ where: { name_doc: { name: data.name, doc: data.doc } } })
        if (existing) throw new AppError('Company with this name and document already exists', 409)
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

export const updateCompany = async (id: string, { userId, ...data }: UpdateCompanyInput) => {
    const existing = await prisma.company.findUnique({
        where: { id },
        include: { users: { select: { userId: true } } },
    })
    if (!existing) {
        throw new AppError('Company not found', 404)
    }

    if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new AppError('User not found', 404)
        }
    }

    const name = data.name ?? existing.name
    const doc = data.doc !== undefined ? data.doc : existing.doc
    if (doc && (name !== existing.name || doc !== existing.doc)) {
        const conflict = await prisma.company.findUnique({ where: { name_doc: { name, doc } } })
        if (conflict && conflict.id !== id) throw new AppError('Company with this name and document already exists', 409)
    }

    const company = await prisma.$transaction(async (tx) => {
        const updated = await tx.company.update({
            where: { id },
            data,
            select: companySelect,
        })

        // vínculo N:N aditivo — não desvincula os usuários existentes
        if (userId) {
            await tx.userCompany.upsert({
                where: { userId_companyId: { userId, companyId: id } },
                create: { userId, companyId: id },
                update: {},
            })
        }

        return updated
    })

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    const affectedUsers = new Set(existing.users.map((u) => u.userId))
    if (userId) affectedUsers.add(userId)
    await Promise.all([...affectedUsers].map((uid) => CompaniesCache.invalidateCompaniesByUser(uid)))
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

    const [extensions, queues, trunks, inboundRoutes, outboundPatterns] = await Promise.all([
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
            select: { name: true, registrationMode: true, identifyBy: true, username: true },
        }),
        prisma.inboundRoute.findMany({
            where: { companyId: id },
            select: { trunkId: true, did: { select: { number: true } } },
        }),
        prisma.outboundDialPattern.findMany({
            where: { route: { companyId: id } },
            select: { pattern: true },
        }),
    ])

    const pjsipNumbers = extensions.filter((e) => e.type === 'pjsip').map((e) => e.number)
    const sipNumbers = extensions.filter((e) => e.type === 'sip').map((e) => e.number)
    const asteriskInterfaces = extensions.map((e) => `${e.type.toUpperCase()}/${e.number}`)
    const asteriskQueueNames = queues.map((q) => `${existing.asteriskId}-${q.name}`)

    const trunkIds = trunks.map((t) => `${existing.asteriskId}-trunk-${t.name}`)
    const trunkOutboundIds = trunks
        .filter((t) => t.registrationMode === 'outbound')
        .map((t) => `${existing.asteriskId}-trunk-${t.name}`)
    const trunkUsernameEndpointIds = trunks
        .filter((t) => t.identifyBy === 'username' && t.username)
        .map((t) => t.username as string)

    const inboundRoutesForCleanup = inboundRoutes.map((r) => ({ trunkId: r.trunkId, didNumber: r.did.number }))
    const outboundPatternValues = outboundPatterns.map((p) => p.pattern)

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.removeMembersByInterfaces(tx, asteriskInterfaces)
        await AsteriskQueueRepository.deleteManyQueues(tx, asteriskQueueNames)
        await InboundRouteRepository.deleteMany(tx, inboundRoutesForCleanup)
        if (outboundPatternValues.length > 0)
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: { in: outboundPatternValues } } })
        await PjsipRepository.deleteManyByIds(tx, [...pjsipNumbers, ...trunkIds], trunkOutboundIds, trunkUsernameEndpointIds)
        await SipRepository.deleteManyByNames(tx, sipNumbers)
        await tx.extension.deleteMany({ where: { companyId: id } })
        await tx.company.delete({ where: { id } })
    })

    // pasta de áudios + arquivos de dialplan da empresa — fora do banco, best-effort após o commit
    await rm(audioSoundDir(existing.asteriskId), { recursive: true, force: true })
    await removeCompanyDialplanFiles(existing.asteriskId, DIALPLAN_FILE_CONTEXTS)

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
