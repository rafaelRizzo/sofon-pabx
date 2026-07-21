import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { AnnouncementsCache } from './cache/announcements.cache'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { FlowEdgeRepository } from '../../asterisk/flow-edge.repository'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
import { validateRouteDestination, assertNotReferenced } from '../../schemas/route-destination.validate'
import { resolveDestinationLabels, withDestinationLabel } from '../../schemas/route-destination-label'
import { resolveUsedByLabels, type UsedByRef } from '../../schemas/flow-reference-label'
import type { RouteDestination } from '../../schemas/route-destination.schema'
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from './schemas/announcement.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    audioId: true,
    createdAt: true,
    updatedAt: true,
} as const

const toDto = <T extends { audioId: string | null; destination: RouteDestination; usedBy: UsedByRef[] }>(a: T) => ({ ...a, hasAudio: a.audioId !== null })

// Anexa o nome legível de destination (resolvido no backend, cache-first — ver
// route-destination-label.ts). Todas as chamadas aqui são de uma única empresa por vez.
async function withDestinationLabels<T extends { destination: unknown }>(announcements: T[], companyId: string): Promise<T[]> {
    if (announcements.length === 0) return announcements
    const labelMap = await resolveDestinationLabels(announcements.map((a) => a.destination as RouteDestination), companyId)
    return announcements.map((a) => ({ ...a, destination: withDestinationLabel(a.destination as RouteDestination, labelMap) }))
}

export const getAnnouncementsByCompany = async (companyId: string) => {
    const cached = await AnnouncementsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const [rows, edges] = await Promise.all([
        prisma.announcement.findMany({ where: { companyId }, select }),
        FlowEdgeRepository.getBySource(companyId, 'announcement'),
    ])
    const usedByMap = await resolveUsedByLabels('announcement', rows.map((a) => a.id), companyId)
    const dtos = await withDestinationLabels(
        rows.map((a) => toDto({ ...a, destination: edges.get(a.id)?.default ?? null, usedBy: usedByMap.get(a.id) ?? [] })),
        companyId,
    )
    await AnnouncementsCache.setByCompany(companyId, dtos)
    return dtos
}

export const getAnnouncementById = async (id: string) => {
    const cached = await AnnouncementsCache.getAnnouncement(id)
    if (cached) return cached

    const announcement = await prisma.announcement.findUnique({ where: { id }, select })
    if (!announcement) throw new AppError('Announcement not found', 404)

    const [destination, usedByMap] = await Promise.all([
        FlowEdgeRepository.getOne('announcement', id, 'default'),
        resolveUsedByLabels('announcement', [id], announcement.companyId),
    ])
    const dto = (await withDestinationLabels([toDto({ ...announcement, destination, usedBy: usedByMap.get(id) ?? [] })], announcement.companyId))[0]!
    await AnnouncementsCache.setAnnouncement(id, dto)
    return dto
}

export const createAnnouncement = async (data: CreateAnnouncementInput) => {
    await getCompanyById(data.companyId)

    const existing = await prisma.announcement.findUnique({
        where: { name_companyId: { name: data.name, companyId: data.companyId } },
    })
    if (existing) throw new AppError('Announcement already exists for this company', 409)

    await assertAudioBelongsToCompany(data.audioId, data.companyId)
    await validateRouteDestination(data.destination ?? null, data.companyId)

    const announcement = await prisma.$transaction(async (tx) => {
        const created = await tx.announcement.create({
            data: {
                name: data.name,
                companyId: data.companyId,
                audioId: data.audioId,
            },
            select,
        })
        await FlowEdgeRepository.setSlot(tx, data.companyId, 'announcement', created.id, 'default', data.destination ?? null)
        return created
    })

    try {
        await AnnouncementRepository.regenerate(data.companyId)
    } finally {
        await AnnouncementsCache.invalidateByCompany(data.companyId)
    }
    return toDto({ ...announcement, destination: data.destination ?? null, usedBy: [] })
}

export const updateAnnouncement = async (id: string, data: UpdateAnnouncementInput) => {
    const existing = await prisma.announcement.findUnique({ where: { id } })
    if (!existing) throw new AppError('Announcement not found', 404)

    if (data.name !== undefined && data.name !== existing.name) {
        const conflict = await prisma.announcement.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Announcement already exists for this company', 409)
    }

    if (data.audioId !== undefined) await assertAudioBelongsToCompany(data.audioId, existing.companyId)
    if (data.destination !== undefined) await validateRouteDestination(data.destination, existing.companyId)

    const announcement = await prisma.$transaction(async (tx) => {
        const updated = await tx.announcement.update({
            where: { id },
            data: {
                name: data.name,
                audioId: data.audioId,
            },
            select,
        })
        if (data.destination !== undefined) {
            await FlowEdgeRepository.setSlot(tx, existing.companyId, 'announcement', id, 'default', data.destination)
        }
        return updated
    })

    try {
        await AnnouncementRepository.regenerate(existing.companyId)
    } finally {
        await AnnouncementsCache.invalidateAnnouncement(id)
        await AnnouncementsCache.invalidateByCompany(existing.companyId)
    }
    const [destination, usedByMap] = await Promise.all([
        data.destination !== undefined ? data.destination : FlowEdgeRepository.getOne('announcement', id, 'default'),
        resolveUsedByLabels('announcement', [id], existing.companyId),
    ])
    return toDto({ ...announcement, destination, usedBy: usedByMap.get(id) ?? [] })
}

export const deleteAnnouncement = async (id: string) => {
    const existing = await prisma.announcement.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Announcement not found', 404)

    await assertNotReferenced('announcement', id)

    await prisma.$transaction(async (tx) => {
        await tx.announcement.delete({ where: { id } })
        await FlowEdgeRepository.deleteAllForSource(tx, 'announcement', id)
    })

    try {
        await AnnouncementRepository.regenerate(existing.companyId)
    } finally {
        await AnnouncementsCache.invalidateAnnouncement(id)
        await AnnouncementsCache.invalidateByCompany(existing.companyId)
    }
}
