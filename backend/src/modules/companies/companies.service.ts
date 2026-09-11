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
import { removeCompanyDialplanFiles, withDialplanLock, reloadDialplanNow } from '../../asterisk/dialplan-file.repository'
import { HolidayGroupRepository } from '../../asterisk/holidaygroup.repository'
import { TimeConditionRepository } from '../../asterisk/timecondition.repository'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { RequestTemplateRepository } from '../../asterisk/request-template.repository'
import { VariableRepository } from '../../asterisk/variable.repository'
import { VariableConditionRepository } from '../../asterisk/variablecondition.repository'
import { CallcenterSurveyRepository } from '../../asterisk/callcenter-survey.repository'
import { FlowNodeRepository } from '../../asterisk/flow-node.repository'
import { FlowRepository } from '../../asterisk/flow.repository'
import { DialplanRepository } from '../../asterisk/dialplan.repository'
import { ensureStaticAsteriskConfig } from '../../asterisk/ensure-static-config'
import { removeBlindTransferFeature } from '../../asterisk/features.repository'
import { runAmiCommand } from '../../asterisk/ami-client'
import { TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT, VAR_CONTEXT, VARCOND_CONTEXT, SURVEY_CONTEXT, FLOW_CONTEXT, FLOW_NODE_CONTEXT, FORMATTER_CONTEXT } from '../../asterisk/dialplan-names'
import { FormatterNodeRepository } from '../../asterisk/destinations/formatter-node.repository'
import { RequestTemplatesCache } from '../request-templates/cache/request-templates.cache'
import { HolidayGroupsCache } from '../holiday-groups/cache/holiday-groups.cache'
import { VariablesCache } from '../variables/cache/variables.cache'
import { VariableConditionsCache } from '../variable-conditions/cache/variable-conditions.cache'
import { UsersCache } from '../users/cache/users.cache'
import { invalidateUserCompanyIds } from '../../utils/auth/access'

const DIALPLAN_FILE_CONTEXTS = [
    TC_CONTEXT, HOL_CONTEXT, ANNOUNCEMENT_CONTEXT, IVR_CONTEXT, REQUEST_TEMPLATE_CONTEXT, QUEUE_APP_CONTEXT,
    VAR_CONTEXT, VARCOND_CONTEXT, SURVEY_CONTEXT, FLOW_CONTEXT, FLOW_NODE_CONTEXT, FORMATTER_CONTEXT,
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
    notes: true,
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

    // HolidayGroup não precisa regenerar aqui: desde a migração pra AGI (ver holidaygroup.repository.ts),
    // o timezone é lido ao vivo de Company a cada chamada, não fica mais baked no .conf estático como
    // TimeCondition (GotoIfTime nativo, sem esse luxo)
    if (data.timezone !== undefined && data.timezone !== existing.timezone) {
        await TimeConditionRepository.regenerate(id)
    }

    await CompaniesCache.invalidateCompany(id)
    await CompaniesCache.invalidateAllCompanies()
    const affectedUsers = existing.users.map((u) => u.userId)
    await Promise.all(affectedUsers.map((uid) => CompaniesCache.invalidateCompaniesByUser(uid)))
    await Promise.all(affectedUsers.map((uid) => CompaniesCache.invalidateCompaniesForScope(uid)))
    await Promise.all(affectedUsers.map((uid) => invalidateUserCompanyIds(uid)))
    return company
}

// regenera todo dialplan estático (/etc/asterisk/dialplan-extra/**) da empresa a partir do banco -
// mesma lista de contextos de DIALPLAN_FILE_CONTEXTS acima, usado quando os arquivos em disco somem
// (ex: reinstalação do Asterisk que manteve o banco intacto) sem precisar salvar módulo por módulo
//
// Lock por empresa: é uma ação explícita de admin (não um CRUD de rotina), então duas chamadas
// concorrentes pra mesma empresa devem serializar em vez de intercalar delete+recreate do padrão
// genérico de "ramais" (ponto sem lock próprio, ver dialplan.repository.ts).
export const resyncDialplan = async (id: string) => {
    const company = await getCompanyById(id)

    return withDialplanLock(`resync:${company.id}`, async () => {
        // Esqueleto global (ramais/transfer/from-trunk/from-trunk-routed) + tunáveis globais de
        // features.conf (ver ensure-static-config.ts) - mesma rotina chamada no boot do backend,
        // reusada aqui pra um admin conseguir forçar a correção sem esperar o próximo restart.
        const staticConfig = await ensureStaticAsteriskConfig()
        if (staticConfig.baseDialplanRewritten && !staticConfig.dialplanReloadApplied) {
            throw new AppError(
                'sofon-managed.conf regenerado, mas o reload via AMI falhou ou não foi confirmado - verifique AMI_HOST/AMI_SECRET e rode "dialplan reload" manualmente no Asterisk',
                502,
            )
        }
        if (staticConfig.restartRequired) {
            throw new AppError(
                'transferdigittimeout ajustado em features.conf, mas essa config não recarrega a quente nessa versão do Asterisk - rode "systemctl restart asterisk" manualmente pra aplicar (derruba chamadas ativas)',
                502,
            )
        }

        // Migração global idempotente: remove o atalho cego legado #1 sem tocar nas outras
        // configurações de features.conf. Só recarrega o módulo quando o arquivo mudou.
        const blindTransferRemoved = await removeBlindTransferFeature()
        const blindTransferReloadApplied = blindTransferRemoved
            ? await runAmiCommand('module reload res_features.so')
            : false
        if (blindTransferRemoved && !blindTransferReloadApplied) {
            throw new AppError(
                'Transferência cega #1 removida de features.conf, mas o reload de res_features via AMI falhou ou não foi confirmado - reinicie/recarregue o Asterisk manualmente',
                502,
            )
        }

        await HolidayGroupRepository.regenerate(company.id)
        await TimeConditionRepository.regenerate(company.id)
        await AnnouncementRepository.regenerate(company.id)
        await IvrRepository.regenerate(company.id)
        await AsteriskQueueRepository.regenerate(company.id)
        await RequestTemplateRepository.regenerate(company.id)
        await FormatterNodeRepository.regenerate(company.id)
        await VariableRepository.regenerate(company.id)
        await VariableConditionRepository.regenerate(company.id)
        await FlowNodeRepository.regenerate(company.id)
        await FlowRepository.regenerate(company.id)
        await CallcenterSurveyRepository.regenerate(company.id)

        // Padrão genérico de "ramais" (Realtime, não é arquivo estático) - compartilhado entre TODAS
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

        // Mesma lógica: inbound routes criadas antes de uma mudança de template (novos campos de
        // CDR, gravação) nunca são regeradas sozinhas - só via update() manual de cada rota. Isso força.
        const inboundRoutes = await InboundRouteRepository.regenerateAll(company.id) ?? 0

        // Drift: InboundRoute apagada por fora do fluxo normal (tamper manual, bug, restore parcial)
        // deixa linha Realtime órfã que regenerateAll nunca toca (só recria o que existe hoje no
        // banco). Reconcilia removendo o que sobrou sem InboundRoute correspondente.
        const orphansPruned = await InboundRouteRepository.pruneOrphans(company.id)

        // Mesma lógica: outbound route patterns criados antes de uma mudança de template (novos
        // campos de CDR, gravação) nunca são regerados sozinhos - só via update() manual de cada pattern.
        const outboundRoutes = await regenerateAllOutboundPatterns(company.id) ?? 0

        // Ação explícita de admin, diferente do reload debounced/fire-and-forget usado pelos CRUDs
        // individuais (reloadDialplan() em dialplan-file.repository.ts): aqui o chamador precisa do
        // resultado real. Arquivos/Realtime já estão corretos em disco/banco neste ponto, mas sem
        // reload confirmado o Asterisk continua rodando o dialplan antigo em memória - o admin
        // precisa saber disso, não receber sucesso falso (200) com o reload nunca confirmado.
        const reloadApplied = await reloadDialplanNow()
        if (!reloadApplied) {
            throw new AppError(
                'Dialplan regenerado no banco/disco, mas o reload via AMI falhou ou não foi confirmado - verifique AMI_HOST/AMI_SECRET e rode "dialplan reload" manualmente no Asterisk',
                502,
            )
        }

        return {
            ...staticConfig,
            blindTransferRemoved,
            blindTransferReloadApplied,
            staticContexts: DIALPLAN_FILE_CONTEXTS,
            realtimeContexts: contexts.map((c) => c.context),
            inboundRoutes,
            outboundRoutes,
            orphansPruned,
            reloadApplied,
        }
    })
}

// Não roda em paralelo: cada resyncDialplan já serializa por empresa (withDialplanLock) e mexe no
// esqueleto global (ensureStaticAsteriskConfig, features.conf) - rodar N empresas ao mesmo tempo só
// faria essas etapas globais colidirem entre si sem ganho real de tempo. Uma empresa que falhar não
// interrompe as demais - erro é capturado e reportado por empresa no resultado final.
export const resyncAllCompaniesDialplan = async () => {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } })

    const results: Array<{ companyId: string; name: string; success: boolean; error?: string }> = []
    for (const company of companies) {
        try {
            await resyncDialplan(company.id)
            results.push({ companyId: company.id, name: company.name, success: true })
        } catch (error) {
            results.push({
                companyId: company.id,
                name: company.name,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return {
        total: companies.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
    }
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

    // pasta de áudios + arquivos de dialplan da empresa - fora do banco, best-effort após o commit
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
