import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { AnnouncementsCache } from './cache/announcements.cache'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { audioSoundPath } from '../../asterisk/audio.repository'
import { assertAudioBelongsToCompany } from '../audios/audios.service'
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

const toDto = <T extends { audioId: string | null }>(a: T) => ({ ...a, hasAudio: a.audioId !== null })

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Reconstrói (ou remove) o dialplan da empresa a partir do audioId atual — chamado dentro da mesma
// transação sempre que create/update mexe em audioId. Sem áudio vinculado, não há dialplan (mesmo
// padrão de IvrMenu — ver IvrService.resyncDialplan).
async function resyncDialplan(tx: Tx, id: string) {
    const announcement = await tx.announcement.findUnique({
        where: { id },
        select: { audioId: true, company: { select: { asteriskId: true } } },
    })
    if (!announcement) return
    if (!announcement.audioId) {
        await AnnouncementRepository.removeEntry(tx, id)
        return
    }
    const soundPath = audioSoundPath(announcement.company.asteriskId, announcement.audioId)
    await AnnouncementRepository.syncEntry(tx, id, soundPath)
}

export const getAnnouncementsByCompany = async (companyId: string) => {
    const cached = await AnnouncementsCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const announcements = await prisma.announcement.findMany({ where: { companyId }, select })
    const dtos = announcements.map(toDto)
    await AnnouncementsCache.setByCompany(companyId, dtos)
    return dtos
}

export const getAnnouncementById = async (id: string) => {
    const cached = await AnnouncementsCache.getAnnouncement(id)
    if (cached) return cached

    const announcement = await prisma.announcement.findUnique({ where: { id }, select })
    if (!announcement) throw new AppError('Announcement not found', 404)

    const dto = toDto(announcement)
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

    const announcement = await prisma.$transaction(async (tx) => {
        const created = await tx.announcement.create({ data, select })
        await resyncDialplan(tx, created.id)
        return created
    })

    await AnnouncementsCache.invalidateByCompany(data.companyId)
    return toDto(announcement)
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

    const announcement = await prisma.$transaction(async (tx) => {
        const updated = await tx.announcement.update({ where: { id }, data, select })
        await resyncDialplan(tx, id)
        return updated
    })

    await AnnouncementsCache.invalidateAnnouncement(id)
    await AnnouncementsCache.invalidateByCompany(existing.companyId)
    return toDto(announcement)
}

export const deleteAnnouncement = async (id: string) => {
    const existing = await prisma.announcement.findUnique({ where: { id }, select: { companyId: true } })
    if (!existing) throw new AppError('Announcement not found', 404)

    await prisma.$transaction(async (tx) => {
        await AnnouncementRepository.removeEntry(tx, id)
        await tx.announcement.delete({ where: { id } })
    })

    await AnnouncementsCache.invalidateAnnouncement(id)
    await AnnouncementsCache.invalidateByCompany(existing.companyId)
}
