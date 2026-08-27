import { prisma } from '../../lib/prisma'
import { recordingFilenameSuffix } from '../../asterisk/dialplan-names'
import { RAMAL_ALIAS_LENGTHS } from '../../asterisk/dialplan/dialplan.repository'
import { getCompanyById } from '../companies/companies.service'
import { getExtensionDto } from '../extensions/extensions.service'
import { AppError } from '../../utils/errors/app.error'
import { OutboundRoutesCache } from './cache/outbound-routes.cache'
import type {
    CreateOutboundRouteInput,
    UpdateOutboundRouteInput,
    AddPatternInput,
    UpdatePatternInput,
    SetTrunksInput,
} from './schemas/outbound-route.schema'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

function trunkAsteriskId(asteriskId: string, trunkName: string): string {
    return `${asteriskId}-trunk-${trunkName}`
}

type CustomHeader = { name: string; value: string }

type TrunkOpt = {
    id: string
    astId: string
    type: string
    registrationMode: string
    context: string
    maxOut?: number | null
    techPrefix?: string | null
    customHeaders?: CustomHeader[]
}

// Priority count per trunk block (used to pre-compute offsets for forward references):
// custom (sem endpoint PJSIP)   = 1 (Goto pro contexto custom, sem failover/headers)
// with limit + not last = 7 (GotoIf count, Set GROUP, Set CDR trunk_id, Dial, Set CDR hangup_cause, GotoIf DIALSTATUS, Set GROUP=)
// with limit + last    = 5 (GotoIf count, Set GROUP, Set CDR trunk_id, Dial, Set CDR hangup_cause)
// no limit + not last  = 4 (Set CDR trunk_id, Dial, Set CDR hangup_cause, GotoIf DIALSTATUS)
// no limit + last      = 3 (Set CDR trunk_id, Dial, Set CDR hangup_cause)
// + 1 Set(PJSIP_HEADER(add,...)) por header customizado da trunk, sempre antes do Dial
function trunkBlockSize(trunk: TrunkOpt, isLast: boolean): number {
    if (trunk.registrationMode === 'custom') return 1
    const hasLimit = trunk.maxOut != null
    const base = hasLimit ? (isLast ? 5 : 7) : isLast ? 3 : 4
    return base + (trunk.type === 'pjsip' ? (trunk.customHeaders?.length ?? 0) : 0)
}

function buildDialplanEntries(
    context: string,
    exten: string,
    trunks: TrunkOpt[],
    prefix: string | null | undefined,
    prepend: string | null | undefined,
    asteriskId: string,
    routeName: string,
): Array<{ context: string; exten: string; priority: number; app: string; appdata: string | null }> {
    const hasTransform = !!(prefix || prepend)
    const destVar = hasTransform ? '${ODEST}' : '${EXTEN}'

    // Pre-compute start priority of each trunk block
    const noopOffset = 1 // NoOp de debug (rota/pattern/origem/destino) - sempre a priority 1
    const transformOffset = hasTransform ? 1 : 0
    const recFileOffset = 1
    const mixmonitorOffset = 1
    const cdrOffset = 5 // Set(CDR(direction|origin_extension|dialed_number|recording_file), TRANSFER_CONTEXT)
    const baseOffset = noopOffset + transformOffset + recFileOffset + mixmonitorOffset + cdrOffset + 1 // 1-indexed

    const blockStarts: number[] = []
    let cursor = baseOffset
    for (let i = 0; i < trunks.length; i++) {
        blockStarts.push(cursor)
        cursor += trunkBlockSize(trunks[i]!, i === trunks.length - 1)
    }
    const hangupPriority = cursor

    const entries: any[] = []
    let p = 1

    // Debug de roteamento - mostra qual rota/pattern casou e origem/destino no CLI/log
    entries.push({
        context, exten, priority: p++, app: 'NoOp',
        appdata: 'Saida outbound: rota=' + routeName + ' pattern=' + exten
            + ' origem=${CALLERID(num)} destino=' + destVar,
    })

    if (hasTransform) {
        const strip = prefix ? prefix.length : 0
        entries.push({
            context, exten, priority: p++, app: 'Set',
            appdata: `__ODEST=${prepend ?? ''}\${EXTEN:${strip}}`,
        })
    }

    entries.push({
        context, exten, priority: p++, app: 'Set',
        appdata: `REC_FILE=/var/spool/asterisk/monitor/${asteriskId}/\${STRFTIME(\${EPOCH},,%Y/%m/%d)}/`
            + recordingFilenameSuffix('${CUT(CALLERID(num),_,1)}', destVar),
    })
    entries.push({ context, exten, priority: p++, app: 'MixMonitor', appdata: '${REC_FILE},b' })

    // Enriquecimento de CDR - uma vez só por chamada (não por tronco tentado)
    entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'CDR(direction)=outbound' })
    entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'CDR(origin_extension)=${CALLERID(num)}' })
    entries.push({ context, exten, priority: p++, app: 'Set', appdata: `CDR(dialed_number)=${destVar}` })
    entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'CDR(recording_file)=${REC_FILE}' })
    entries.push({ context, exten, priority: p++, app: 'Set', appdata: '__TRANSFER_CONTEXT=transfer' })

    for (let i = 0; i < trunks.length; i++) {
        const { id: trunkId, astId, type, registrationMode, context: customContext, maxOut, techPrefix, customHeaders } = trunks[i]!
        const isLast = i === trunks.length - 1
        const nextTrunkStart = isLast ? hangupPriority : blockStarts[i + 1]
        const tech = type === 'iax' ? 'IAX2' : 'PJSIP'
        // A chamada parte do ramal, portanto ele é a parte chamadora e requer "T" para transferir.
        const dialTarget = `${tech}/${techPrefix ?? ''}${destVar}@${astId},60,T`

        if (registrationMode === 'custom') {
            entries.push({ context, exten, priority: p++, app: 'Goto', appdata: `${customContext},${destVar},1` })
            continue
        }

        // PJSIP_HEADER não existe em IAX2 - sem headers SIP customizados nesse tech
        if (type === 'pjsip') {
            for (const h of customHeaders ?? []) {
                entries.push({
                    context, exten, priority: p++, app: 'Set',
                    appdata: `PJSIP_HEADER(add,${h.name})=${h.value}`,
                })
            }
        }

        if (maxOut != null) {
            entries.push({
                context, exten, priority: p++, app: 'GotoIf',
                appdata: `$[\${GROUP_COUNT(out-${astId})} >= ${maxOut}]?${nextTrunkStart}`,
            })
            entries.push({ context, exten, priority: p++, app: 'Set', appdata: `GROUP()=out-${astId}` })
            entries.push({ context, exten, priority: p++, app: 'Set', appdata: `CDR(trunk_id)=${trunkId}` })
            entries.push({ context, exten, priority: p++, app: 'Dial', appdata: dialTarget })
            entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'CDR(hangup_cause)=${HANGUPCAUSE}' })
            if (!isLast) {
                entries.push({
                    context, exten, priority: p++, app: 'GotoIf',
                    appdata: `$["\${DIALSTATUS}"="CHANUNAVAIL"]?${p}:${hangupPriority}`,
                })
                entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'GROUP()=' })
            }
        } else {
            entries.push({ context, exten, priority: p++, app: 'Set', appdata: `CDR(trunk_id)=${trunkId}` })
            entries.push({ context, exten, priority: p++, app: 'Dial', appdata: dialTarget })
            entries.push({ context, exten, priority: p++, app: 'Set', appdata: 'CDR(hangup_cause)=${HANGUPCAUSE}' })
            if (!isLast) {
                entries.push({
                    context, exten, priority: p++, app: 'GotoIf',
                    appdata: `$["\${DIALSTATUS}"="CHANUNAVAIL"]?${p}:${hangupPriority}`,
                })
            }
        }
    }

    entries.push({ context, exten, priority: p, app: 'Hangup', appdata: null })
    return entries
}

async function syncPatternDialplan(
    tx: Tx,
    context: string,
    exten: string,
    trunks: TrunkOpt[],
    prefix: string | null | undefined,
    prepend: string | null | undefined,
    asteriskId: string,
    routeName: string,
) {
    await tx.extensions.deleteMany({ where: { context, exten } })
    const entries = buildDialplanEntries(context, exten, trunks, prefix, prepend, asteriskId, routeName)
    await tx.extensions.createMany({ data: entries })
}

// Reservado pro contexto global 'ramais': ensureGenericRoutingPattern (aliases de ramal) + ensureFallback
// (destino não encontrado) - ver dialplan.repository.ts. Um outbound route usando um desses patterns
// sobrescreve/apaga esse dialplan do sistema (já aconteceu em produção: pattern "_X." de um outbound
// route apagou o fallback global de "destino não encontrado" pra TODAS as empresas).
const RESERVED_RAMAIS_PATTERNS = new Set<string>([
    '_X.',
    ...RAMAL_ALIAS_LENGTHS.map((len) => `_${'X'.repeat(len)}`),
])

// O dialplan é escrito em context='ramais' + exten=pattern (ver syncPatternDialplan) - duas rotas da
// mesma empresa com o mesmo padrão se sobrescrevem silenciosamente no Asterisk, então o padrão precisa
// ser único por empresa. exclude.routeId ignora TODOS os padrões de uma rota (replace completo, ex:
// updateOutboundRoute); exclude.patternId ignora só um registro específico (edição pontual, updatePattern).
async function assertPatternsAvailable(
    companyId: string,
    patterns: string[],
    exclude?: { routeId?: string; patternId?: string },
) {
    for (const pattern of patterns) {
        if (RESERVED_RAMAIS_PATTERNS.has(pattern)) {
            throw new AppError(`Padrão "${pattern}" é reservado pelo sistema (contexto ramais) e não pode ser usado em outbound route`, 409)
        }
    }

    const seen = new Set<string>()
    for (const pattern of patterns) {
        if (seen.has(pattern)) {
            throw new AppError(`Padrão de discagem duplicado no formulário: "${pattern}"`, 409)
        }
        seen.add(pattern)
    }

    const conflict = await prisma.outboundDialPattern.findFirst({
        where: {
            pattern: { in: patterns },
            ...(exclude?.patternId && { id: { not: exclude.patternId } }),
            route: {
                companyId,
                ...(exclude?.routeId && { id: { not: exclude.routeId } }),
            },
        },
        select: { pattern: true, route: { select: { name: true } } },
    })
    if (conflict) {
        throw new AppError(
            `Padrão "${conflict.pattern}" já está em uso na rota "${conflict.route.name}"`,
            409
        )
    }
}

// Sequential queries inside transaction - avoids concurrent client.query() from multi-relation include
async function getRouteContext(tx: Tx, routeId: string) {
    const route = await tx.outboundRoute.findUnique({
        where: { id: routeId },
        select: { name: true, company: { select: { asteriskId: true } } },
    })
    if (!route) return null

    const patterns = await tx.outboundDialPattern.findMany({
        where: { routeId },
        orderBy: { position: 'asc' },
    })

    // trunk is many-to-one → JOIN within findMany - single query
    const trunks = await tx.outboundRouteTrunk.findMany({
        where: { routeId },
        select: {
            position: true,
            trunk: {
                select: {
                    id: true, name: true, type: true, maxOutChannels: true, techPrefix: true, customHeaders: true,
                    registrationMode: true, context: true,
                },
            },
        },
        orderBy: { position: 'asc' },
    })

    return { company: route.company, routeName: route.name, patterns, trunks }
}

export async function resyncAllPatterns(tx: Tx, routeId: string) {
    const ctx = await getRouteContext(tx, routeId)
    if (!ctx) return

    const trunkOpts: TrunkOpt[] = ctx.trunks.map((rt) => ({
        id: rt.trunk.id,
        astId: trunkAsteriskId(ctx.company.asteriskId, rt.trunk.name),
        type: rt.trunk.type,
        registrationMode: rt.trunk.registrationMode,
        context: rt.trunk.context,
        maxOut: rt.trunk.maxOutChannels,
        techPrefix: rt.trunk.techPrefix,
        customHeaders: rt.trunk.customHeaders as CustomHeader[],
    }))
    for (const p of ctx.patterns) {
        await syncPatternDialplan(tx, 'ramais', p.pattern, trunkOpts, p.prefix, p.prepend, ctx.company.asteriskId, ctx.routeName)
    }
}

// Mesmo motivo de InboundRouteRepository.regenerateAll - rotas criadas antes de uma mudança de
// template (novos campos de CDR, gravação) nunca são regeradas sozinhas, só via update() manual de
// cada pattern. Usado por resyncDialplan (companies.service.ts).
export async function regenerateAllPatterns(companyId: string) {
    const routes = await prisma.outboundRoute.findMany({ where: { companyId }, select: { id: true } })
    if (routes.length === 0) return 0

    await prisma.$transaction(async (tx) => {
        for (const route of routes) {
            await resyncAllPatterns(tx, route.id)
        }
    })
    return routes.length
}

// Sequential: 4 queries (no multi-relation include) - avoids concurrent client.query()
async function fetchRoute(id: string) {
    const base = await prisma.outboundRoute.findUnique({
        where: { id },
        select: { id: true, name: true, companyId: true, position: true, createdAt: true, updatedAt: true },
    })
    if (!base) return null

    const [patterns, trunks, extensions] = await Promise.all([
        prisma.outboundDialPattern.findMany({
            where: { routeId: id },
            orderBy: { position: 'asc' },
        }),
        prisma.outboundRouteTrunk.findMany({
            where: { routeId: id },
            orderBy: { position: 'asc' },
            select: { id: true, trunkId: true, position: true },
        }),
        prisma.outboundRouteExtension.findMany({
            where: { routeId: id },
            select: { id: true, extensionId: true },
        }),
    ])

    return { ...base, patterns, trunks, extensions }
}

export const getOutboundRoutes = async (companyId: string) => {
    const cached = await OutboundRoutesCache.getByCompany(companyId)
    if (cached) return cached as any[]

    const bases = await prisma.outboundRoute.findMany({
        where: { companyId },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, companyId: true, position: true, createdAt: true, updatedAt: true },
    })

    if (bases.length === 0) {
        await OutboundRoutesCache.setByCompany(companyId, [])
        return []
    }

    const ids = bases.map((r) => r.id)

    const allPatterns = await prisma.outboundDialPattern.findMany({
        where: { routeId: { in: ids } },
        orderBy: { position: 'asc' },
    })
    const allTrunks = await prisma.outboundRouteTrunk.findMany({
        where: { routeId: { in: ids } },
        orderBy: { position: 'asc' },
        select: { id: true, trunkId: true, position: true, routeId: true },
    })
    const allExtensions = await prisma.outboundRouteExtension.findMany({
        where: { routeId: { in: ids } },
        select: { id: true, extensionId: true, routeId: true },
    })

    const routes = bases.map((r) => ({
        ...r,
        patterns: allPatterns.filter((p) => p.routeId === r.id),
        trunks: allTrunks
            .filter((t) => t.routeId === r.id)
            .map(({ routeId: _, ...t }) => t),
        extensions: allExtensions
            .filter((e) => e.routeId === r.id)
            .map(({ routeId: _, ...e }) => e),
    }))

    await OutboundRoutesCache.setByCompany(companyId, routes)
    return routes
}

export const getAllOutboundRoutes = async (companyIds?: string[], userId?: string) => {
    if (companyIds && companyIds.length === 0) return []

    if (!companyIds) {
        const cached = await OutboundRoutesCache.getAll()
        if (cached) return cached as any[]
    } else if (userId) {
        const cached = await OutboundRoutesCache.getForScope(userId)
        if (cached) return cached as any[]
    }

    const bases = await prisma.outboundRoute.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        orderBy: { position: 'asc' },
        select: { id: true, name: true, companyId: true, position: true, createdAt: true, updatedAt: true },
    })

    if (bases.length === 0) {
        if (!companyIds) await OutboundRoutesCache.setAll([])
        else if (userId) await OutboundRoutesCache.setForScope(userId, [])
        return []
    }

    const ids = bases.map((r) => r.id)

    const allPatterns = await prisma.outboundDialPattern.findMany({
        where: { routeId: { in: ids } },
        orderBy: { position: 'asc' },
    })
    const allTrunks = await prisma.outboundRouteTrunk.findMany({
        where: { routeId: { in: ids } },
        orderBy: { position: 'asc' },
        select: { id: true, trunkId: true, position: true, routeId: true },
    })
    const allExtensions = await prisma.outboundRouteExtension.findMany({
        where: { routeId: { in: ids } },
        select: { id: true, extensionId: true, routeId: true },
    })

    const routes = bases.map((r) => ({
        ...r,
        patterns: allPatterns.filter((p) => p.routeId === r.id),
        trunks: allTrunks
            .filter((t) => t.routeId === r.id)
            .map(({ routeId: _, ...t }) => t),
        extensions: allExtensions
            .filter((e) => e.routeId === r.id)
            .map(({ routeId: _, ...e }) => e),
    }))

    if (!companyIds) await OutboundRoutesCache.setAll(routes)
    else if (userId) await OutboundRoutesCache.setForScope(userId, routes)
    return routes
}

export const getOutboundRouteById = async (id: string) => {
    const cached = await OutboundRoutesCache.getRoute(id)
    if (cached) return cached as NonNullable<Awaited<ReturnType<typeof fetchRoute>>>

    const route = await fetchRoute(id)
    if (!route) throw new AppError('Outbound route not found', 404)

    await OutboundRoutesCache.setRoute(id, route)
    return route
}

export const createOutboundRoute = async (data: CreateOutboundRouteInput) => {
    const company = await getCompanyById(data.companyId)

    const trunks = await prisma.trunk.findMany({
        where: { id: { in: data.trunkIds }, companyId: data.companyId },
        select: {
            id: true, name: true, type: true, maxOutChannels: true, techPrefix: true, customHeaders: true,
            registrationMode: true, context: true,
        },
    })
    if (trunks.length !== data.trunkIds.length) throw new AppError('One or more trunks not found', 404)

    const orderedTrunks = data.trunkIds.map((tid, i) => {
        const t = trunks.find((t) => t.id === tid)!
        return {
            id: t.id, name: t.name, type: t.type, maxOutChannels: t.maxOutChannels, techPrefix: t.techPrefix,
            customHeaders: t.customHeaders as CustomHeader[], registrationMode: t.registrationMode,
            context: t.context, position: i,
        }
    })
    const trunkOpts: TrunkOpt[] = orderedTrunks.map((t) => ({
        id: t.id,
        astId: trunkAsteriskId(company.asteriskId, t.name),
        type: t.type,
        registrationMode: t.registrationMode,
        context: t.context,
        maxOut: t.maxOutChannels,
        techPrefix: t.techPrefix,
        customHeaders: t.customHeaders,
    }))

    if (data.extensionIds?.length) {
        const extensions = await prisma.extension.findMany({
            where: { id: { in: data.extensionIds }, companyId: data.companyId },
            select: { id: true },
        })
        if (extensions.length !== data.extensionIds.length) throw new AppError('One or more extensions not found', 404)
    }

    await assertPatternsAvailable(data.companyId, data.patterns.map((p) => p.pattern))

    let routeId: string

    await prisma.$transaction(async (tx) => {
        const route = await tx.outboundRoute.create({
            data: { name: data.name, companyId: data.companyId, position: data.position },
        })
        routeId = route.id

        for (const t of orderedTrunks) {
            await tx.outboundRouteTrunk.create({ data: { routeId: route.id, trunkId: t.id, position: t.position } })
        }
        for (const p of data.patterns) {
            await tx.outboundDialPattern.create({
                data: {
                    routeId: route.id,
                    pattern: p.pattern,
                    prepend: p.prepend ?? null,
                    prefix: p.prefix ?? null,
                    position: p.position,
                },
            })
        }
        if (data.extensionIds?.length) {
            for (const eid of data.extensionIds) {
                await tx.outboundRouteExtension.create({ data: { routeId: route.id, extensionId: eid } })
            }
        }

        for (const p of data.patterns) {
            await syncPatternDialplan(tx, 'ramais', p.pattern, trunkOpts, p.prefix, p.prepend, company.asteriskId, data.name)
        }
    })

    await OutboundRoutesCache.invalidateByCompany(data.companyId)
    await OutboundRoutesCache.invalidateAll()
    return routeId!
}

export const updateOutboundRoute = async (id: string, data: UpdateOutboundRouteInput) => {
    const existing = await prisma.outboundRoute.findUnique({
        where: { id },
        select: { companyId: true },
    })
    if (!existing) throw new AppError('Outbound route not found', 404)

    const { name, position, trunkIds, patterns } = data

    // Fetch existing patterns separately (only when needed) - sequential, no multi-include
    const existingPatterns = patterns
        ? await prisma.outboundDialPattern.findMany({ where: { routeId: id }, select: { pattern: true } })
        : []

    if (trunkIds) {
        const trunks = await prisma.trunk.findMany({
            where: { id: { in: trunkIds }, companyId: existing.companyId },
            select: { id: true },
        })
        if (trunks.length !== trunkIds.length) throw new AppError('One or more trunks not found', 404)
    }

    if (patterns) {
        await assertPatternsAvailable(existing.companyId, patterns.map((p) => p.pattern), { routeId: id })
    }

    await prisma.$transaction(async (tx) => {
        if (name !== undefined || position !== undefined) {
            await tx.outboundRoute.update({
                where: { id },
                data: { ...(name !== undefined && { name }), ...(position !== undefined && { position }) },
            })
        }

        if (trunkIds) {
            await tx.outboundRouteTrunk.deleteMany({ where: { routeId: id } })
            for (const [i, tid] of trunkIds.entries()) {
                await tx.outboundRouteTrunk.create({ data: { routeId: id, trunkId: tid, position: i } })
            }
        }

        if (patterns) {
            for (const p of existingPatterns) {
                await tx.extensions.deleteMany({ where: { context: 'ramais', exten: p.pattern } })
            }
            await tx.outboundDialPattern.deleteMany({ where: { routeId: id } })
            for (const p of patterns) {
                await tx.outboundDialPattern.create({
                    data: {
                        routeId: id,
                        pattern: p.pattern,
                        prepend: p.prepend ?? null,
                        prefix: p.prefix ?? null,
                        position: p.position,
                    },
                })
            }
        }

        if (patterns || trunkIds) {
            await resyncAllPatterns(tx, id)
        }
    })

    const route = await fetchRoute(id)
    await Promise.all([
        OutboundRoutesCache.setRoute(id, route),
        OutboundRoutesCache.invalidateByCompany(existing.companyId),
        OutboundRoutesCache.invalidateAll(),
    ])
    return route!
}

export const deleteOutboundRoute = async (id: string) => {
    const route = await prisma.outboundRoute.findUnique({
        where: { id },
        select: { companyId: true },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    const patterns = await prisma.outboundDialPattern.findMany({
        where: { routeId: id },
        select: { pattern: true },
    })

    await prisma.$transaction(async (tx) => {
        for (const p of patterns) {
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: p.pattern } })
        }
        await tx.outboundRoute.delete({ where: { id } })
    })

    await OutboundRoutesCache.invalidateRoute(id)
    await OutboundRoutesCache.invalidateByCompany(route.companyId)
    await OutboundRoutesCache.invalidateAll()
}

export const addPattern = async (routeId: string, data: AddPatternInput) => {
    const route = await prisma.outboundRoute.findUnique({
        where: { id: routeId },
        select: { id: true, companyId: true },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    await assertPatternsAvailable(route.companyId, [data.pattern])

    let patternId: string

    await prisma.$transaction(async (tx) => {
        const pattern = await tx.outboundDialPattern.create({
            data: {
                routeId,
                pattern: data.pattern,
                prepend: data.prepend ?? null,
                prefix: data.prefix ?? null,
                position: data.position,
            },
        })
        patternId = pattern.id
        await resyncAllPatterns(tx, routeId)
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateAll()
    return patternId!
}

export const updatePattern = async (routeId: string, patternId: string, data: UpdatePatternInput) => {
    const pattern = await prisma.outboundDialPattern.findFirst({
        where: { id: patternId, routeId },
        include: { route: { select: { companyId: true } } },
    })
    if (!pattern) throw new AppError('Pattern not found', 404)

    if (data.pattern && data.pattern !== pattern.pattern) {
        await assertPatternsAvailable(pattern.route.companyId, [data.pattern], { patternId })
    }

    await prisma.$transaction(async (tx) => {
        if (pattern.pattern !== (data.pattern ?? pattern.pattern)) {
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: pattern.pattern } })
        }
        await tx.outboundDialPattern.update({ where: { id: patternId }, data })
        await resyncAllPatterns(tx, routeId)
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateAll()
    return patternId
}

export const deletePattern = async (routeId: string, patternId: string) => {
    const pattern = await prisma.outboundDialPattern.findFirst({ where: { id: patternId, routeId } })
    if (!pattern) throw new AppError('Pattern not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.extensions.deleteMany({ where: { context: 'ramais', exten: pattern.pattern } })
        await tx.outboundDialPattern.delete({ where: { id: patternId } })
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateAll()
}

export const setTrunks = async (routeId: string, data: SetTrunksInput) => {
    const route = await prisma.outboundRoute.findUnique({
        where: { id: routeId },
        select: { companyId: true },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    const trunks = await prisma.trunk.findMany({
        where: { id: { in: data.trunkIds }, companyId: route.companyId },
        select: { id: true, name: true },
    })
    if (trunks.length !== data.trunkIds.length) throw new AppError('One or more trunks not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.outboundRouteTrunk.deleteMany({ where: { routeId } })
        for (const [i, tid] of data.trunkIds.entries()) {
            await tx.outboundRouteTrunk.create({ data: { routeId, trunkId: tid, position: i } })
        }
        await resyncAllPatterns(tx, routeId)
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateByCompany(route.companyId)
    await OutboundRoutesCache.invalidateAll()
}

export const addExtension = async (routeId: string, extensionId: string) => {
    const route = await prisma.outboundRoute.findUnique({
        where: { id: routeId },
        select: { companyId: true },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    const extension = await getExtensionDto(extensionId)
    if (extension.companyId !== route.companyId) throw new AppError('Extension does not belong to the same company as the route', 403)

    const result = await prisma.outboundRouteExtension.create({ data: { routeId, extensionId } })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateByCompany(route.companyId)
    await OutboundRoutesCache.invalidateAll()
    return result
}

export const removeExtension = async (routeId: string, extensionId: string) => {
    const record = await prisma.outboundRouteExtension.findFirst({
        where: { routeId, extensionId },
        select: { id: true },
    })
    if (!record) throw new AppError('Extension not found in route', 404)

    const route = await prisma.outboundRoute.findUnique({
        where: { id: routeId },
        select: { companyId: true },
    })

    await prisma.outboundRouteExtension.delete({ where: { id: record.id } })

    await OutboundRoutesCache.invalidateRoute(routeId)
    if (route) await OutboundRoutesCache.invalidateByCompany(route.companyId)
    await OutboundRoutesCache.invalidateAll()
}
