import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { AnnouncementsCache } from './cache/announcements.cache'
import { AnnouncementRepository, announcementSoundDir, announcementSoundPath } from '../../asterisk/announcement.repository'
import { convertToAsteriskWav } from '../../utils/audio-convert'
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from './schemas/announcement.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    audioUploadedAt: true,
    createdAt: true,
    updatedAt: true,
} as const

const toDto = (a: { audioUploadedAt: Date | null } & Record<string, any>) => {
    const { audioUploadedAt, ...rest } = a
    return { ...rest, hasAudio: audioUploadedAt !== null }
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

    const announcement = await prisma.announcement.create({ data, select })

    await AnnouncementsCache.invalidateByCompany(data.companyId)
    return toDto(announcement)
}

export const updateAnnouncement = async (id: string, data: UpdateAnnouncementInput) => {
    const existing = await prisma.announcement.findUnique({ where: { id } })
    if (!existing) throw new AppError('Announcement not found', 404)

    if (data.name !== existing.name) {
        const conflict = await prisma.announcement.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Announcement already exists for this company', 409)
    }

    const announcement = await prisma.announcement.update({ where: { id }, data, select })

    await AnnouncementsCache.invalidateAnnouncement(id)
    await AnnouncementsCache.invalidateByCompany(existing.companyId)
    return toDto(announcement)
}

export const deleteAnnouncement = async (id: string) => {
    const existing = await prisma.announcement.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Announcement not found', 404)

    await prisma.$transaction(async (tx) => {
        await AnnouncementRepository.removeEntry(tx, id)
        await tx.announcement.delete({ where: { id } })
    })

    await rm(`${announcementSoundPath(existing.company.asteriskId, id)}.wav`, { force: true })

    await AnnouncementsCache.invalidateAnnouncement(id)
    await AnnouncementsCache.invalidateByCompany(existing.companyId)
}

export const uploadAnnouncementAudio = async (id: string, audio: Buffer, originalFilename: string) => {
    const existing = await prisma.announcement.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Announcement not found', 404)

    const dir = announcementSoundDir(existing.company.asteriskId)
    const soundPath = announcementSoundPath(existing.company.asteriskId, id)
    // extensão original preservada — sox detecta o formato de entrada por ela
    const tmpPath = join(tmpdir(), `announcement-upload-${randomUUID()}${extname(originalFilename)}`)

    await mkdir(dir, { recursive: true })
    await writeFile(tmpPath, audio)
    try {
        await convertToAsteriskWav(tmpPath, `${soundPath}.wav`)
    } finally {
        await rm(tmpPath, { force: true })
    }

    const announcement = await prisma.$transaction(async (tx) => {
        await AnnouncementRepository.syncEntry(tx, id, soundPath)
        return tx.announcement.update({ where: { id }, data: { audioUploadedAt: new Date() }, select })
    })

    await AnnouncementsCache.invalidateAnnouncement(id)
    await AnnouncementsCache.invalidateByCompany(existing.companyId)
    return toDto(announcement)
}
