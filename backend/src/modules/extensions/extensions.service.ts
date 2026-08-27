import { randomBytes } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { ExtensionsCache } from './cache/extensions.cache'
import type { CreateExtensionInput, UpdateExtensionInput } from './schemas/extension.schema'
import { sipFieldKeys, sipReadableFieldKeys, pjsipFieldKeys, sipFieldMap, pjsipFieldMap } from './schemas/extension.schema'
import { PjsipRepository } from '../../asterisk/pjsip.repository'
import { SipRepository } from '../../asterisk/sip.repository'
import { DialplanRepository } from '../../asterisk/dialplan.repository'
import { AsteriskQueueRepository } from '../../asterisk/queue.repository'
import { assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import { syncFlowNodeLabel } from '../flows/flow-nodes.service'
import { AppError } from '../../utils/errors/app.error'
import { logger } from '../../utils/logger'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generatePassword = () => {
    const bytes = randomBytes(20)
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

const regenerateFlowNodesSafely = (companyId: string) => {
    void import('../../asterisk/flow-node.repository')
        .then(({ FlowNodeRepository }) => FlowNodeRepository.regenerate(companyId))
        .catch((error) => logger.warn({ event: 'flow-nodes.regenerate.failed', companyId, error: error instanceof Error ? error.message : String(error) }))
}

export type BatchResult = {
    created: Awaited<ReturnType<typeof createExtension>>[]
    errors: { index: number; alias: string; companyId: string; error: string }[]
    total: number
}

function generateAsteriskNumber(alias: string, asteriskId: string): string {
    return `${alias}_${asteriskId}`
}

const GROUP_FIELDS = ['namedcallgroup', 'namedpickupgroup'] as const

function toSipDbFields(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        result[sipFieldMap[key] ?? key] = value
    }
    return result
}

function toPjsipDbFields(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue
        result[pjsipFieldMap[key] ?? key] = value
    }
    return result
}

// Reverso de toSipDbFields/toPjsipDbFields - usado no GET pra devolver os campos crus do sip_peers/ps_endpoints
// já traduzidos de volta pro nome camelCase da API. Usa sipReadableFieldKeys (não sipFieldKeys) pra excluir
// md5Secret/remoteSecret - colunas internas (secret, id, aors, auth, accountcode...) nunca entram em sipFields.
const sipDbToApi: Record<string, string> = Object.fromEntries(sipReadableFieldKeys.map((k) => [sipFieldMap[k] ?? k, k]))
const pjsipDbToApi: Record<string, string> = Object.fromEntries(pjsipFieldKeys.map((k) => [pjsipFieldMap[k] ?? k, k]))

function fromDbFields(row: Record<string, any>, dbToApi: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [column, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue
        const apiKey = dbToApi[column]
        if (apiKey) result[apiKey] = value
    }
    return result
}

// ps_aors não tem prefixo "aor_" nas colunas - reconstrói o nome usado em pjsipFieldMap antes de traduzir de volta
function fromAorDbFields(row: Record<string, any>, dbToApi: Record<string, string>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [column, value] of Object.entries(row)) {
        if (column === 'id' || value === null || value === undefined) continue
        const apiKey = dbToApi[`aor_${column}`]
        if (apiKey) result[apiKey] = value
    }
    return result
}

function prefixGroups(groups: string, asteriskId: string): string {
    return groups.split(',').map((g) => `${asteriskId}-${g.trim()}`).join(',')
}

function applyGroupPrefixes(data: Record<string, any>, asteriskId: string): Record<string, any> {
    const result = { ...data }
    for (const field of GROUP_FIELDS) {
        if (typeof result[field] === 'string') {
            result[field] = prefixGroups(result[field], asteriskId)
        }
    }
    return result
}

async function checkAsteriskSync(number: string, type: string): Promise<boolean> {
    if (type === 'pjsip') {
        const r = await prisma.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
        return !!r
    }
    const r = await prisma.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
    return !!r
}

// Campos crus do sip_peers/ps_endpoints+ps_aors pro GET de detalhe - sempre lido ao vivo (nunca cacheado junto
// com o dto), já que reflete config do Asterisk que pode mudar fora da API (ex: CLI, reset de senha)
async function getAsteriskDetails(number: string, type: string): Promise<Record<string, any>> {
    if (type === 'pjsip') {
        const [endpoint, aor] = await Promise.all([
            prisma.ps_endpoints.findUnique({ where: { id: number } }),
            prisma.ps_aors.findUnique({ where: { id: number } }),
        ])
        return {
            ...(endpoint ? fromDbFields(endpoint, pjsipDbToApi) : {}),
            ...(aor ? fromAorDbFields(aor, pjsipDbToApi) : {}),
        }
    }
    const peer = await prisma.sip_peers.findUnique({ where: { name: number } })
    return peer ? fromDbFields(peer, sipDbToApi) : {}
}

async function provisionMissingAsteriskRecord(
    tx: Tx,
    opts: { number: string; type: string; name: string; context: string }
): Promise<string | null> {
    const { number, type, name, context } = opts

    if (type === 'pjsip') {
        const exists = await tx.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
        if (exists) return null
        const password = generatePassword()
        await PjsipRepository.createExtension(tx, number, { password, name, context, extras: {} })
        await DialplanRepository.ensureGenericRoutingPattern(tx, context)
        await DialplanRepository.ensureFallback(tx, context)
        return password
    }

    const exists = await tx.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
    if (exists) return null
    const password = generatePassword()
    await SipRepository.createExtension(tx, number, password, context, { callerid: `${name} <${number}>` })
    await DialplanRepository.ensureGenericRoutingPattern(tx, context)
    await DialplanRepository.ensureFallback(tx, context)
    return password
}

export const getAllExtensions = async (companyIds?: string[], userId?: string) => {
    const singleCompanyId = companyIds?.length === 1 ? companyIds[0] : null
    const isAll = companyIds === undefined
    // Não-admin com mais de uma empresa vinculada - nem singleCompanyId nem isAll cobrem esse caso
    const isMultiCompanyScope = !singleCompanyId && !isAll && (companyIds?.length ?? 0) > 1

    type GroupedExtensions = { sip: any[]; pjsip: any[] }
    let grouped: GroupedExtensions | null = null

    if (singleCompanyId) grouped = (await ExtensionsCache.getByCompany(singleCompanyId)) as GroupedExtensions | null
    else if (isAll) grouped = (await ExtensionsCache.getAllExtensions()) as GroupedExtensions | null
    else if (isMultiCompanyScope && userId) grouped = (await ExtensionsCache.getForScope(userId)) as GroupedExtensions | null

    if (grouped) return grouped

    const extensions = await prisma.extension.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        select: {
            id: true,
            alias: true,
            number: true,
            type: true,
            name: true,
            context: true,
            allowOutbound: true,
            companyId: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    const mapped = extensions.map(({ number, allowOutbound, ...rest }) => ({ ...rest, allowOutbound, username: number }))
    const sip = mapped.filter((e) => e.type === 'sip')
    const pjsip = mapped.filter((e) => e.type === 'pjsip')

    const pjsipNumbers = pjsip.map((e) => e.username)
    const sipNumbers = sip.map((e) => e.username)

    const [pjsipSync, sipSync] = await Promise.all([
        pjsipNumbers.length > 0
            ? prisma.ps_endpoints.findMany({ where: { id: { in: pjsipNumbers } }, select: { id: true } })
            : [],
        sipNumbers.length > 0
            ? prisma.sip_peers.findMany({ where: { name: { in: sipNumbers } }, select: { name: true } })
            : [],
    ])

    const pjsipSynced = new Set(pjsipSync.map((e: any) => e.id))
    const sipSynced = new Set(sipSync.map((e: any) => e.name))

    // usedBy é resolvido por empresa (query de FlowEdgeRepository.getReferencesToMany é global,
    // mas o nome de quem referencia precisa ser buscado escopado à empresa de cada extensão -
    // ver resolveUsedByLabels). Nas listagens cross-empresa (isAll/isMultiCompanyScope) as
    // extensões podem pertencer a empresas diferentes, então agrupa por companyId antes de resolver.
    const idsByCompany = new Map<string, string[]>()
    for (const e of mapped) {
        const ids = idsByCompany.get(e.companyId) ?? []
        ids.push(e.id)
        idsByCompany.set(e.companyId, ids)
    }
    const usedByMapsByCompany = await Promise.all(
        [...idsByCompany.entries()].map(([cId, ids]) => resolveUsedByLabels('extension', ids, cId)),
    )
    const usedByMap = new Map<string, UsedByRef[]>()
    for (const map of usedByMapsByCompany) for (const [id, labels] of map) usedByMap.set(id, labels)

    grouped = {
        sip: sip.map((e) => ({ ...e, synced: sipSynced.has(e.username), usedBy: usedByMap.get(e.id) ?? [] })),
        pjsip: pjsip.map((e) => ({ ...e, synced: pjsipSynced.has(e.username), usedBy: usedByMap.get(e.id) ?? [] })),
    }

    if (singleCompanyId) await ExtensionsCache.setByCompany(singleCompanyId, grouped)
    else if (isAll) await ExtensionsCache.setAllExtensions(grouped)
    else if (isMultiCompanyScope && userId) await ExtensionsCache.setForScope(userId, grouped)

    return grouped
}

// Export em massa - única leitura que expõe secret/password de propósito, então nunca passa
// pelo ExtensionsCache (que guarda o DTO público) e consulta sip_peers/ps_auths direto
export const getExtensionsForExport = async (companyIds?: string[], userId?: string) => {
    const grouped = await getAllExtensions(companyIds, userId)
    const all = [...grouped.sip, ...grouped.pjsip] as Array<{
        id: string
        alias: string
        username: string
        name: string
        type: 'sip' | 'pjsip'
        companyId: string
    }>

    const sipUsernames = all.filter((e) => e.type === 'sip').map((e) => e.username)
    const pjsipUsernames = all.filter((e) => e.type === 'pjsip').map((e) => e.username)

    const [sipSecrets, pjsipSecrets] = await Promise.all([
        sipUsernames.length > 0
            ? prisma.sip_peers.findMany({ where: { name: { in: sipUsernames } }, select: { name: true, secret: true } })
            : [],
        pjsipUsernames.length > 0
            ? prisma.ps_auths.findMany({ where: { id: { in: pjsipUsernames } }, select: { id: true, password: true } })
            : [],
    ])

    const sipSecretByUsername = new Map(sipSecrets.map((s: any) => [s.name, s.secret]))
    const pjsipSecretByUsername = new Map(pjsipSecrets.map((s: any) => [s.id, s.password]))

    return all.map((e) => ({
        id: e.id,
        alias: e.alias,
        username: e.username,
        name: e.name,
        type: e.type,
        companyId: e.companyId,
        password: (e.type === 'sip' ? sipSecretByUsername.get(e.username) : pjsipSecretByUsername.get(e.username)) ?? '',
    }))
}

const extensionSelect = {
    id: true,
    alias: true,
    number: true,
    type: true,
    name: true,
    context: true,
    allowOutbound: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
} as const

type ExtensionDto = {
    id: string
    alias: string
    username: string
    type: string
    name: string
    context: string
    allowOutbound: boolean
    companyId: string
    createdAt: Date
    updatedAt: Date
}

// Lookup cacheado usado por outros módulos que só precisam de companyId/type/username pra
// checagem de ownership ou validação de destino (ex: time-conditions, inbound-routes,
// outbound-routes, queue-members) - evita repetir prisma.extension.findUnique em cada um
export const getExtensionDto = async (id: string): Promise<ExtensionDto> => {
    const cached = await ExtensionsCache.getExtension<ExtensionDto>(id)
    if (cached) return cached

    const extension = await prisma.extension.findUnique({
        where: { id },
        select: extensionSelect,
    })
    if (!extension) throw new AppError('Extension not found', 404)
    const { number, allowOutbound, ...rest } = extension
    const dto: ExtensionDto = { ...rest, allowOutbound, username: number }
    await ExtensionsCache.setExtension(id, dto)
    return dto
}

export const getExtensionById = async (id: string): Promise<ExtensionDto & { synced: boolean; usedBy: UsedByRef[] }> => {
    const dto = await getExtensionDto(id)

    // Não cacheado junto com live details - resolvido fresco a cada leitura (mesma decisão de
    // flow-reference-label.ts, indicador não crítico o bastante pra justificar cache próprio).
    const usedByMap = await resolveUsedByLabels('extension', [id], dto.companyId)
    const usedBy = usedByMap.get(id) ?? []

    type LiveDetails = { synced: boolean } & Record<string, any>
    const cachedLive = await ExtensionsCache.getLiveDetails<LiveDetails>(id)
    if (cachedLive) return { ...dto, ...cachedLive, usedBy }

    const [synced, details] = await Promise.all([
        checkAsteriskSync(dto.username, dto.type),
        getAsteriskDetails(dto.username, dto.type),
    ])
    const live: LiveDetails = { ...details, synced }
    await ExtensionsCache.setLiveDetails(id, live)
    return { ...dto, ...live, usedBy }
}

export const createExtension = async (data: CreateExtensionInput) => {
    const { alias, type, name, companyId, context } = data
    const password = generatePassword()

    const existing = await prisma.extension.findUnique({
        where: { alias_companyId: { alias, companyId } },
    })
    if (existing) throw new AppError('Extension already exists for this company', 409)

    const company = await getCompanyById(companyId)

    const number = generateAsteriskNumber(alias, company.asteriskId)

    const asteriskNumberExists = await prisma.ps_endpoints.findUnique({ where: { id: number } })
    if (asteriskNumberExists) throw new AppError('Asterisk number conflict, contact support', 409)

    const allowOutbound = data.allowOutbound !== false
    const allowOutboundSetvar = `ALLOW_OUTBOUND=${allowOutbound ? 1 : 0}`

    if (type === 'pjsip') {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, allowOutbound: _ao, ...pjsipExtras } = data
        const mappedExtras = toPjsipDbFields(pjsipExtras)
        // accountcode sempre = asteriskId da empresa - isola CDR por empresa, sobrepõe accountCode enviado pelo cliente
        const pjsipExtrasWithGroups = applyGroupPrefixes(
            { ...mappedExtras, setvar: allowOutboundSetvar, accountcode: company.asteriskId },
            company.asteriskId,
        )

        await prisma.$transaction(async (tx) => {
            await PjsipRepository.createExtension(tx, number, { password, name, context, extras: pjsipExtrasWithGroups })
            await DialplanRepository.ensureGenericRoutingPattern(tx, context)
            await DialplanRepository.ensureFallback(tx, context)
            await tx.extension.create({ data: { alias, number, type, name, context, allowOutbound, companyId } })
        })
    } else {
        const { alias: _a, type: _t, name: _n, companyId: _c, context: _ctx, allowOutbound: _ao, peerType, ...sipExtras } = data
        const sipData: Record<string, any> = toSipDbFields(sipExtras)
        if (peerType) sipData.type = peerType
        sipData.setvar = sipData.setvar ? `${allowOutboundSetvar}\n${sipData.setvar}` : allowOutboundSetvar
        // callerid default = name do ramal - pjsip já faz isso automaticamente (pjsip.repository.ts), sip não tinha
        if (sipData.callerid === undefined) sipData.callerid = `${name} <${number}>`
        // accountcode sempre = asteriskId da empresa - isola CDR por empresa, sobrepõe accountCode enviado pelo cliente
        sipData.accountcode = company.asteriskId

        await prisma.$transaction(async (tx) => {
            await SipRepository.createExtension(tx, number, password, context, sipData)
            await DialplanRepository.ensureGenericRoutingPattern(tx, context)
            await DialplanRepository.ensureFallback(tx, context)
            await tx.extension.create({ data: { alias, number, type, name, context, allowOutbound, companyId } })
        })
    }

    await ExtensionsCache.invalidateAllExtensions()
    const created = await prisma.extension.findUnique({ where: { alias_companyId: { alias, companyId } }, select: { id: true } })
    const extension = await getExtensionById(created!.id)
    return { ...extension, password }
}

export const updateExtension = async (id: string, data: UpdateExtensionInput) => {
    const existing = await prisma.extension.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Extension not found', 404)

    const { alias, number, type, context, companyId } = existing
    const { name, alias: newAlias, context: newContext, allowOutbound: newAllowOutbound, ...typeFields } = data

    const aliasChanged = newAlias !== undefined && newAlias !== alias
    const contextChanged = newContext !== undefined && newContext !== context
    const effectiveNumber = aliasChanged ? generateAsteriskNumber(newAlias, existing.company.asteriskId) : number
    const effectiveContext = newContext ?? context

    if (aliasChanged) {
        const conflict = await prisma.extension.findUnique({
            where: { alias_companyId: { alias: newAlias, companyId } },
        })
        if (conflict) throw new AppError('Extension alias already in use for this company', 409)
    }

    let provisionedPassword: string | null = null

    await prisma.$transaction(async (tx) => {
        provisionedPassword = await provisionMissingAsteriskRecord(tx, {
            number,
            type,
            name: existing.name,
            context,
        })

        if (contextChanged) {
            await DialplanRepository.ensureGenericRoutingPattern(tx, effectiveContext)
        }

        if (type === 'pjsip') {
            if (aliasChanged) {
                await PjsipRepository.renameExtension(tx, number, effectiveNumber)
                await AsteriskQueueRepository.updateMemberInterfaces(tx, `PJSIP/${number}`, `PJSIP/${effectiveNumber}`)
            }

            const endpointUpdate: Record<string, any> = {}
            const aorUpdate: Record<string, any> = {}

            if (name !== undefined) endpointUpdate.callerid = `${name} <${effectiveNumber}>`
            if (contextChanged) endpointUpdate.context = effectiveContext
            if (newAllowOutbound !== undefined) endpointUpdate.setvar = `ALLOW_OUTBOUND=${newAllowOutbound ? 1 : 0}`

            for (const key of pjsipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value === undefined) continue
                const dbKey = pjsipFieldMap[key] ?? key
                if (dbKey.startsWith('aor_')) aorUpdate[dbKey.slice(4)] = value
                else endpointUpdate[dbKey] = value
            }

            const endpointUpdateWithGroups = applyGroupPrefixes(endpointUpdate, existing.company.asteriskId)
            await PjsipRepository.updateExtension(tx, effectiveNumber, endpointUpdateWithGroups, aorUpdate)
        } else {
            if (aliasChanged) {
                await SipRepository.renameExtension(tx, number, effectiveNumber)
                await AsteriskQueueRepository.updateMemberInterfaces(tx, `SIP/${number}`, `SIP/${effectiveNumber}`)
            }

            const sipUpdate: Record<string, any> = {}
            if (contextChanged) sipUpdate.context = effectiveContext
            if (newAllowOutbound !== undefined) sipUpdate.setvar = `ALLOW_OUTBOUND=${newAllowOutbound ? 1 : 0}`

            for (const key of sipFieldKeys) {
                const value = (typeFields as any)[key]
                if (value !== undefined) sipUpdate[sipFieldMap[key] ?? key] = value
            }

            await SipRepository.updateExtension(tx, effectiveNumber, sipUpdate)
        }

        const extUpdate: Record<string, any> = {}
        if (name !== undefined) extUpdate.name = name
        if (aliasChanged) { extUpdate.alias = newAlias; extUpdate.number = effectiveNumber }
        if (contextChanged) extUpdate.context = effectiveContext
        if (newAllowOutbound !== undefined) extUpdate.allowOutbound = newAllowOutbound

        if (Object.keys(extUpdate).length > 0)
            await tx.extension.update({ where: { id }, data: extUpdate })
    })

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateLiveDetails(id)
    await ExtensionsCache.invalidateAllExtensions()
    if (aliasChanged || contextChanged) regenerateFlowNodesSafely(existing.companyId)
    if (name !== undefined && name !== existing.name) await syncFlowNodeLabel('extension', id, name)
    const updated = await getExtensionById(id)
    return provisionedPassword ? { ...updated, provisioned: true, password: provisionedPassword } : updated
}

export const resetExtensionPassword = async (id: string) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    const { number, type, name, context } = existing
    const password = generatePassword()

    await prisma.$transaction(async (tx) => {
        if (type === 'pjsip') {
            const exists = await tx.ps_endpoints.findUnique({ where: { id: number }, select: { id: true } })
            if (!exists) {
                await PjsipRepository.createExtension(tx, number, { password, name, context, extras: {} })
                await DialplanRepository.ensureGenericRoutingPattern(tx, context)
            } else {
                await tx.ps_auths.update({ where: { id: number }, data: { password } })
            }
        } else {
            const exists = await tx.sip_peers.findUnique({ where: { name: number }, select: { id: true } })
            if (!exists) {
                await SipRepository.createExtension(tx, number, password, context, { callerid: `${name} <${number}>` })
                await DialplanRepository.ensureGenericRoutingPattern(tx, context)
            } else {
                await tx.sip_peers.update({ where: { name: number }, data: { secret: password } })
            }
        }
    })

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateLiveDetails(id)
    await ExtensionsCache.invalidateAllExtensions()
    return { password }
}

// Self-service: usuário logado busca as credenciais do PRÓPRIO ramal pra registrar o softphone
// WebRTC no browser (ver User.extensionId) - sem gate de permissão de extensions, é identidade,
// não CRUD de terceiro (mesma lógica de /auth/me)
export const getMyWebrtcCredentials = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { extensionId: true } })
    if (!user?.extensionId) throw new AppError('Nenhum ramal vinculado a este usuário', 404)

    const extension = await prisma.extension.findUnique({ where: { id: user.extensionId } })
    if (!extension) throw new AppError('Extension not found', 404)
    if (extension.type !== 'pjsip') throw new AppError('Ramal legado (chan_sip) não suporta WebRTC', 400)

    const endpoint = await prisma.ps_endpoints.findUnique({ where: { id: extension.number }, select: { webrtc: true } })
    if (!endpoint?.webrtc) throw new AppError('WebRTC não habilitado para este ramal', 400)

    const auth = await prisma.ps_auths.findUnique({ where: { id: extension.number }, select: { password: true } })
    if (!auth?.password) throw new AppError('Credenciais do ramal não encontradas', 404)

    return { username: extension.number, password: auth.password, displayName: extension.name, context: extension.context }
}

export const createExtensionBatch = async (items: CreateExtensionInput[]): Promise<BatchResult> => {
    const results = await Promise.allSettled(items.map((item) => createExtension(item)))

    const created: BatchResult['created'] = []
    const errors: BatchResult['errors'] = []

    results.forEach((r, i) => {
        const item = items[i]!
        if (r.status === 'fulfilled') {
            created.push(r.value)
        } else {
            errors.push({
                index: i,
                alias: item.alias,
                companyId: item.companyId,
                error: r.reason instanceof AppError ? r.reason.message : 'Internal error',
            })
        }
    })

    return { created, errors, total: items.length }
}

export const deleteExtension = async (id: string) => {
    const existing = await prisma.extension.findUnique({ where: { id } })
    if (!existing) throw new AppError('Extension not found', 404)

    await assertNotReferenced('extension', id)

    const { alias, companyId, number, type } = existing
    const asteriskInterface = `${type.toUpperCase()}/${number}`

    await prisma.$transaction(async (tx) => {
        await AsteriskQueueRepository.removeMembersByInterfaces(tx, [asteriskInterface])

        if (type === 'pjsip') {
            await PjsipRepository.deleteExtension(tx, number)
        } else {
            await SipRepository.deleteExtension(tx, number)
        }

        await tx.extension.delete({ where: { id } })
    })

    await ExtensionsCache.invalidateExtension(id)
    await ExtensionsCache.invalidateLiveDetails(id)
    await ExtensionsCache.invalidateAllExtensions()
    return { id, alias, companyId }
}
