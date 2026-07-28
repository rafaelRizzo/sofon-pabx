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
import { AsteriskQueueRepository, QUEUE_APP_CONTEXT, toAsteriskQueueName } from '../../asterisk/queue.repository'
import { InboundRouteRepository } from '../../asterisk/inboundroute.repository'
import { regenerateAllPatterns as regenerateAllOutboundPatterns } from '../outbound-routes/outbound-routes.service'
import { audioSoundDir } from '../../asterisk/audio.repository'
import { removeCompanyDialplanFiles } from '../../asterisk/dialplan-file.repository'
import { HolidayGroupRepository } from '../../asterisk/holidaygroup.repository'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { RequestTemplateRepository } from '../../asterisk/request-template.repository'
import { VariableRepository } from '../../asterisk/variable.repository'
import { VariableConditionRepository } from '../../asterisk/variablecondition.repository'
import { CallcenterSurveyRepository } from '../../asterisk/callcenter-survey.repository'
import { FlowNodeRepository } from '../../asterisk/flow-node.repository'
import { DialplanRepository } from '../../asterisk/dialplan.repository'
import { TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT, VAR_CONTEXT, VARCOND_CONTEXT, SURVEY_CONTEXT, FLOW_NODE_CONTEXT } from '../../asterisk/dialplan-names'
import { RequestTemplatesCache } from '../request-templates/cache/request-templates.cache'
import { HolidayGroupsCache } from '../holiday-groups/cache/holiday-groups.cache'
import { VariablesCache } from '../variables/cache/variables.cache'
import { VariableConditionsCache } from '../variable-conditions/cache/variable-conditions.cache'
import { UsersCache } from '../users/cache/users.cache'
import { invalidateUserCompanyIds } from '../../utils/auth/access'

const DIALPLAN_FILE_CONTEXTS = [
    TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT, QUEUE_APP_CONTEXT,
    VAR_CONTEXT, VARCOND_CONTEXT, SURVEY_CONTEXT, FLOW_NODE_CONTEXT,
]
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
    elevenLabsApiKey: true,
    createdAt: true,
    updatedAt: true,
} as const

const _byId = () => prisma.company.findUnique({ where: { id: '' }, select: companySelect })
export type CompanyDto = NonNullable<Awaited<ReturnType<typeof _byId>>>

export const getAllCompanies = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await CompaniesCache.getAllCompanies()
        if (cached) return cached
    } else if (userId) {
        const cached = await CompaniesCache.getCompaniesForScope(userId)
        if (cached) return cached
    }

    const companies = await prisma.company.findMany({
        where: companyIds ? { id: { in: companyIds } } : undefined,
        select: companySelect,
    })

    if (!companyIds) await CompaniesCache.setAllCompanies(companies)
    else if (userId) await CompaniesCache.setCompaniesForScope(userId, companies)
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

export const createCompany = async (data: CreateCompanyInput, userId: string) => {
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
    await CompaniesCache.invalidateCompaniesForScope(userId)
    await invalidateUserCompanyIds(userId)
    await UsersCache.invalidateUser(userId)
    await UsersCache.invalidateAllUsers()
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

    const name = data.name ?? existing.name
    const doc = data.doc !== undefined ? data.doc : existing.doc
    if (doc && (name !== existing.name || doc !== existing.doc)) {
        const conflict = await prisma.company.findUnique({ where: { name_doc: { name, doc } } })
        if (conflict && conflict.id !== id) throw new AppError('Company with this name and document already exists', 409)
    }

    const company = await prisma.company.update({
        where: { id },
        data,
        select: companySelect,
    })

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    const affectedUsers = existing.users.map((u) => u.userId)
    await Promise.all(affectedUsers.map((uid) => CompaniesCache.invalidateCompaniesByUser(uid)))
    await Promise.all(affectedUsers.map((uid) => CompaniesCache.invalidateCompaniesForScope(uid)))
    await Promise.all(affectedUsers.map((uid) => invalidateUserCompanyIds(uid)))
    return company
}

// regenera todo dialplan estático (/etc/asterisk/dialplan-extra/**) da empresa a partir do banco —
// mesma lista de contextos de DIALPLAN_FILE_CONTEXTS acima, usado quando os arquivos em disco somem
// (ex: reinstalação do Asterisk que manteve o banco intacto) sem precisar salvar módulo por módulo
export const resyncDialplan = async (id: string) => {
    const company = await getCompanyById(id)
    await HolidayGroupRepository.regenerate(company.id)
    await TimeConditionRepository.regenerate(company.id)
    await AnnouncementRepository.regenerate(company.id)
    await IvrRepository.regenerate(company.id)
    await AsteriskQueueRepository.regenerate(company.id)
    await RequestTemplateRepository.regenerate(company.id)
    await VariableRepository.regenerate(company.id)
    await VariableConditionRepository.regenerate(company.id)
    await FlowNodeRepository.regenerate(company.id)
    await CallcenterSurveyRepository.regenerate(company.id)

    // Padrão genérico de "ramais" (Realtime, não é arquivo estático) — compartilhado entre TODAS
    // as empresas por contexto, não só a desta. Refeito aqui (delete+recreate, ver
    // dialplan.repository.ts) pra garantir que instalações antigas peguem mudanças de template
    // (novas prioridades de CDR, formato de gravação) sem precisar recriar cada ramal manualmente.
    const contexts = await prisma.extension.findMany({
        where: { companyId: id },
        select: { context: true },
        distinct: ['context']
    })
    await prisma.$transaction(async (tx) => {
        for (const { context } of contexts) {
            await DialplanRepository.ensureGenericRoutingPattern(tx, context)
            await DialplanRepository.ensureFallback(tx, context)
        }
    })

    // Mesma lógica: inbound routes criadas antes de uma mudança de template (novos campos de CDR,
    // gravação) nunca são regeradas sozinhas — só via update() manual de cada rota. Isso força.
    await InboundRouteRepository.regenerateAll(company.id)

    // Mesma lógica: outbound route patterns criados antes de uma mudança de template (novos campos
    // de CDR, gravação) nunca são regerados sozinhos — só via update() manual de cada pattern.
    await regenerateAllOutboundPatterns(company.id)
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
            select: { id: true, number: true },
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
    const queueIds = queues.map((q) => q.id)
    const asteriskQueueNames = queues.map((q) => toAsteriskQueueName(existing.asteriskId, q.number))

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
        await AsteriskQueueRepository.deleteManyQueues(tx, queueIds, asteriskQueueNames)
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
        VariablesCache.invalidateNamespace(),
        VariableConditionsCache.invalidateNamespace(),
        ...existing.users.map((u) => CompaniesCache.invalidateCompaniesByUser(u.userId)),
        ...existing.users.map((u) => CompaniesCache.invalidateCompaniesForScope(u.userId)),
        ...existing.users.map((u) => invalidateUserCompanyIds(u.userId)),
        ...existing.users.map((u) => UsersCache.invalidateUser(u.userId)),
        UsersCache.invalidateAllUsers(),
    ])
}
