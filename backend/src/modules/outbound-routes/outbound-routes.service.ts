import { prisma } from '../../lib/prisma'
import { AppError } from '../../utils/errors/app.error'
import { OutboundRoutesCache } from './cache/outbound-routes.cache'
import type {
    CreateOutboundRouteInput,
    UpdateOutboundRouteInput,
    AddPatternInput,
    UpdatePatternInput,
    SetTrunksInput,
} from './outbound-routes.schema'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Mirrors the trunk naming convention in trunks.service.ts
function trunkAsteriskId(asteriskId: string, trunkName: string): string {
    return `${asteriskId}-trunk-${trunkName}`
}

function buildDialplanEntries(
    context: string,
    exten: string,
    trunkAstIds: string[],
    prefix: string | null | undefined,
    prepend: string | null | undefined,
    asteriskId: string,
): Array<{ context: string; exten: string; priority: number; app: string; appdata: string | null }> {
    const hasTransform = !!(prefix || prepend)
    const destVar = hasTransform ? '${ODEST}' : '${EXTEN}'
    const hangupPriority = (hasTransform ? 1 : 0) + 1 + 2 * trunkAstIds.length

    const entries: any[] = []
    let p = 1

    if (hasTransform) {
        const strip = prefix ? prefix.length : 0
        entries.push({
            context, exten, priority: p++, app: 'Set',
            appdata: `__ODEST=${prepend ?? ''}\${EXTEN:${strip}}`,
        })
    }

    entries.push({
        context, exten, priority: p++, app: 'MixMonitor',
        appdata: `/var/spool/asterisk/monitor/${asteriskId}/\${STRFTIME(,,%Y%m%d)}/\${UNIQUEID}.wav,b`,
    })

    for (let i = 0; i < trunkAstIds.length; i++) {
        entries.push({ context, exten, priority: p++, app: 'Dial', appdata: `PJSIP/${destVar}@${trunkAstIds[i]},60` })
        if (i < trunkAstIds.length - 1) {
            entries.push({
                context, exten, priority: p++, app: 'GotoIf',
                appdata: `$["\${DIALSTATUS}"="CHANUNAVAIL"]?${p}:${hangupPriority}`,
            })
        }
    }

    entries.push({ context, exten, priority: p, app: 'Hangup', appdata: null })
    return entries
}

async function syncPatternDialplan(
    tx: Tx,
    context: string,
    exten: string,
    trunkAstIds: string[],
    prefix: string | null | undefined,
    prepend: string | null | undefined,
    asteriskId: string,
) {
    await tx.extensions.deleteMany({ where: { context, exten } })
    if (trunkAstIds.length > 0) {
        await tx.extensions.createMany({ data: buildDialplanEntries(context, exten, trunkAstIds, prefix, prepend, asteriskId) })
    }
}

async function getRouteWithTrunks(tx: Tx, routeId: string) {
    return tx.outboundRoute.findUnique({
        where: { id: routeId },
        include: {
            company: { select: { asteriskId: true } },
            patterns: { orderBy: { position: 'asc' } },
            trunks: {
                include: { trunk: { select: { name: true } } },
                orderBy: { position: 'asc' },
            },
        },
    })
}

async function resyncAllPatterns(tx: Tx, routeId: string) {
    const route = await getRouteWithTrunks(tx, routeId)
    if (!route) return

    const trunkAstIds = route.trunks.map((rt) => trunkAsteriskId(route.company.asteriskId, rt.trunk.name))
    for (const p of route.patterns) {
        await syncPatternDialplan(tx, 'ramais', p.pattern, trunkAstIds, p.prefix, p.prepend, route.company.asteriskId)
    }
}

const routeSelect = {
    id: true,
    name: true,
    companyId: true,
    position: true,
    createdAt: true,
    updatedAt: true,
    patterns: { orderBy: { position: 'asc' as const } },
    trunks: {
        orderBy: { position: 'asc' as const },
        select: { id: true, trunkId: true, position: true },
    },
    extensions: {
        select: { id: true, extensionId: true },
    },
} as const

export const getOutboundRoutes = async (companyId: string) => {
    const cached = await OutboundRoutesCache.getByCompany(companyId)
    if (cached) return cached as any[]

    const routes = await prisma.outboundRoute.findMany({
        where: { companyId },
        orderBy: { position: 'asc' },
        select: routeSelect,
    })

    await OutboundRoutesCache.setByCompany(companyId, routes)
    return routes
}

export const getOutboundRouteById = async (id: string) => {
    const cached = await OutboundRoutesCache.getRoute(id)
    if (cached) return cached as NonNullable<typeof route>

    const route = await prisma.outboundRoute.findUnique({ where: { id }, select: routeSelect })
    if (!route) throw new AppError('Outbound route not found', 404)

    await OutboundRoutesCache.setRoute(id, route)
    return route
}

export const createOutboundRoute = async (data: CreateOutboundRouteInput) => {
    const company = await prisma.company.findUnique({
        where: { id: data.companyId },
        select: { asteriskId: true },
    })
    if (!company) throw new AppError('Company not found', 404)

    const trunks = await prisma.trunk.findMany({
        where: { id: { in: data.trunkIds }, companyId: data.companyId },
        select: { id: true, name: true },
    })
    if (trunks.length !== data.trunkIds.length) throw new AppError('One or more trunks not found', 404)

    const orderedTrunks = data.trunkIds.map((tid, i) => {
        const t = trunks.find((t) => t.id === tid)!
        return { id: t.id, name: t.name, position: i }
    })
    const trunkAstIds = orderedTrunks.map((t) => trunkAsteriskId(company.asteriskId, t.name))

    let routeId: string

    await prisma.$transaction(async (tx) => {
        const route = await tx.outboundRoute.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                position: data.position,
                trunks: {
                    create: orderedTrunks.map((t) => ({ trunkId: t.id, position: t.position })),
                },
                patterns: {
                    create: data.patterns.map((p) => ({
                        pattern: p.pattern,
                        prepend: p.prepend ?? null,
                        prefix: p.prefix ?? null,
                        position: p.position,
                    })),
                },
                ...(data.extensionIds?.length
                    ? { extensions: { create: data.extensionIds.map((eid) => ({ extensionId: eid })) } }
                    : {}),
            },
        })
        routeId = route.id

        for (const p of data.patterns) {
            await syncPatternDialplan(tx, 'ramais', p.pattern, trunkAstIds, p.prefix, p.prepend, company.asteriskId)
        }
    })

    await OutboundRoutesCache.invalidateByCompany(data.companyId)
    return getOutboundRouteById(routeId!)
}

export const updateOutboundRoute = async (id: string, data: UpdateOutboundRouteInput) => {
    const existing = await prisma.outboundRoute.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } }, patterns: true },
    })
    if (!existing) throw new AppError('Outbound route not found', 404)

    const { name, position, trunkIds, patterns } = data

    if (trunkIds) {
        const trunks = await prisma.trunk.findMany({
            where: { id: { in: trunkIds }, companyId: existing.companyId },
            select: { id: true },
        })
        if (trunks.length !== trunkIds.length) throw new AppError('One or more trunks not found', 404)
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
            await tx.outboundRouteTrunk.createMany({
                data: trunkIds.map((tid, i) => ({ routeId: id, trunkId: tid, position: i })),
            })
        }

        if (patterns) {
            for (const p of existing.patterns) {
                await tx.extensions.deleteMany({ where: { context: 'ramais', exten: p.pattern } })
            }
            await tx.outboundDialPattern.deleteMany({ where: { routeId: id } })
            await tx.outboundDialPattern.createMany({
                data: patterns.map((p) => ({
                    routeId: id,
                    pattern: p.pattern,
                    prepend: p.prepend ?? null,
                    prefix: p.prefix ?? null,
                    position: p.position,
                })),
            })
        }

        if (patterns || trunkIds) {
            await resyncAllPatterns(tx, id)
        }
    })

    await OutboundRoutesCache.invalidateRoute(id)
    await OutboundRoutesCache.invalidateByCompany(existing.companyId)
    return getOutboundRouteById(id)
}

export const deleteOutboundRoute = async (id: string) => {
    const route = await prisma.outboundRoute.findUnique({
        where: { id },
        include: { patterns: true },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    await prisma.$transaction(async (tx) => {
        for (const p of route.patterns) {
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: p.pattern } })
        }
        await tx.outboundRoute.delete({ where: { id } })
    })

    await OutboundRoutesCache.invalidateRoute(id)
    await OutboundRoutesCache.invalidateByCompany(route.companyId)
}

export const addPattern = async (routeId: string, data: AddPatternInput) => {
    const route = await prisma.outboundRoute.findUnique({ where: { id: routeId } })
    if (!route) throw new AppError('Outbound route not found', 404)

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
    return prisma.outboundDialPattern.findUnique({ where: { id: patternId! } })
}

export const updatePattern = async (routeId: string, patternId: string, data: UpdatePatternInput) => {
    const pattern = await prisma.outboundDialPattern.findFirst({ where: { id: patternId, routeId } })
    if (!pattern) throw new AppError('Pattern not found', 404)

    await prisma.$transaction(async (tx) => {
        if (pattern.pattern !== (data.pattern ?? pattern.pattern)) {
            await tx.extensions.deleteMany({ where: { context: 'ramais', exten: pattern.pattern } })
        }
        await tx.outboundDialPattern.update({ where: { id: patternId }, data })
        await resyncAllPatterns(tx, routeId)
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateAll()
    return prisma.outboundDialPattern.findUnique({ where: { id: patternId } })
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
        include: { company: { select: { asteriskId: true } } },
    })
    if (!route) throw new AppError('Outbound route not found', 404)

    const trunks = await prisma.trunk.findMany({
        where: { id: { in: data.trunkIds }, companyId: route.companyId },
        select: { id: true, name: true },
    })
    if (trunks.length !== data.trunkIds.length) throw new AppError('One or more trunks not found', 404)

    await prisma.$transaction(async (tx) => {
        await tx.outboundRouteTrunk.deleteMany({ where: { routeId } })
        await tx.outboundRouteTrunk.createMany({
            data: data.trunkIds.map((tid, i) => ({ routeId, trunkId: tid, position: i })),
        })
        await resyncAllPatterns(tx, routeId)
    })

    await OutboundRoutesCache.invalidateRoute(routeId)
    await OutboundRoutesCache.invalidateByCompany(route.companyId)
}

export const addExtension = async (routeId: string, extensionId: string) => {
    const route = await prisma.outboundRoute.findUnique({ where: { id: routeId } })
    if (!route) throw new AppError('Outbound route not found', 404)

    const ext = await prisma.extension.findUnique({ where: { id: extensionId } })
    if (!ext) throw new AppError('Extension not found', 404)

    return prisma.outboundRouteExtension.create({ data: { routeId, extensionId } })
}

export const removeExtension = async (routeId: string, extensionId: string) => {
    const record = await prisma.outboundRouteExtension.findFirst({ where: { routeId, extensionId } })
    if (!record) throw new AppError('Extension not found in route', 404)

    await prisma.outboundRouteExtension.delete({ where: { id: record.id } })
}
