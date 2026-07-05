import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCompanyById } from '../companies/companies.service'
import { AudiosCache } from './cache/audios.cache'
import { audioSoundDir, audioSoundPath } from '../../asterisk/audio.repository'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { AnnouncementsCache } from '../announcements/cache/announcements.cache'
import { IvrCache } from '../ivr/cache/ivr.cache'
import { convertToAsteriskWav } from '../../utils/audio-convert'
import type { UpdateAudioInput } from './schemas/audio.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    createdAt: true,
    updatedAt: true,
} as const

export const getAudiosByCompany = async (companyId: string) => {
    const cached = await AudiosCache.getByCompany(companyId)
    if (cached) return cached

    await getCompanyById(companyId)

    const audios = await prisma.audio.findMany({ where: { companyId }, select })
    await AudiosCache.setByCompany(companyId, audios)
    return audios
}

export const getAudioById = async (id: string) => {
    const cached = await AudiosCache.getAudio(id)
    if (cached) return cached

    const audio = await prisma.audio.findUnique({ where: { id }, select })
    if (!audio) throw new AppError('Audio not found', 404)

    await AudiosCache.setAudio(id, audio)
    return audio
}

// valida que audioId existe e pertence à empresa — usado por Announcement/IVR ao vincular áudio
export const assertAudioBelongsToCompany = async (audioId: string | null | undefined, companyId: string) => {
    if (!audioId) return
    const audio = await prisma.audio.findUnique({ where: { id: audioId }, select: { companyId: true } })
    if (!audio) throw new AppError('Audio not found', 404)
    if (audio.companyId !== companyId) throw new AppError('Audio belongs to different company', 403)
}

export const createAudio = async (companyId: string, name: string, audio: Buffer, originalFilename: string) => {
    const company = await getCompanyById(companyId)

    const existing = await prisma.audio.findUnique({ where: { name_companyId: { name, companyId } } })
    if (existing) throw new AppError('Audio already exists for this company', 409)

    const created = await prisma.audio.create({ data: { name, companyId }, select })

    const dir = audioSoundDir(company.asteriskId)
    const soundPath = audioSoundPath(company.asteriskId, created.id)
    const tmpPath = join(tmpdir(), `audio-upload-${randomUUID()}${extname(originalFilename)}`)

    await mkdir(dir, { recursive: true })
    await writeFile(tmpPath, audio)
    try {
        await convertToAsteriskWav(tmpPath, `${soundPath}.wav`)
    } catch (error) {
        await prisma.audio.delete({ where: { id: created.id } }).catch(() => {})
        throw error
    } finally {
        await rm(tmpPath, { force: true })
    }

    await AudiosCache.invalidateByCompany(companyId)
    return created
}

export const updateAudio = async (id: string, data: UpdateAudioInput) => {
    const existing = await prisma.audio.findUnique({ where: { id } })
    if (!existing) throw new AppError('Audio not found', 404)

    if (data.name !== existing.name) {
        const conflict = await prisma.audio.findUnique({
            where: { name_companyId: { name: data.name, companyId: existing.companyId } },
        })
        if (conflict) throw new AppError('Audio already exists for this company', 409)
    }

    const audio = await prisma.audio.update({ where: { id }, data, select })

    await AudiosCache.invalidateAudio(id)
    await AudiosCache.invalidateByCompany(existing.companyId)
    return audio
}

// desvincula (SetNull) de qualquer Announcement/IvrMenu que referencie esse áudio — sem isso o
// dialplan deles ficaria com Playback/Read apontando pra um .wav que não existe mais
export const deleteAudio = async (id: string) => {
    const existing = await prisma.audio.findUnique({
        where: { id },
        include: { company: { select: { asteriskId: true } } },
    })
    if (!existing) throw new AppError('Audio not found', 404)

    const [announcements, ivrMenus] = await Promise.all([
        prisma.announcement.findMany({ where: { audioId: id }, select: { id: true, companyId: true } }),
        prisma.ivrMenu.findMany({ where: { audioId: id }, select: { id: true, companyId: true } }),
    ])

    await prisma.$transaction(async (tx) => {
        for (const a of announcements) await AnnouncementRepository.removeEntry(tx, a.id)
        for (const m of ivrMenus) await IvrRepository.removeEntry(tx, m.id)
        await tx.audio.delete({ where: { id } })
    })

    await rm(`${audioSoundPath(existing.company.asteriskId, id)}.wav`, { force: true })

    await Promise.all([
        AudiosCache.invalidateAudio(id),
        AudiosCache.invalidateByCompany(existing.companyId),
        ...announcements.flatMap((a) => [AnnouncementsCache.invalidateAnnouncement(a.id), AnnouncementsCache.invalidateByCompany(a.companyId)]),
        ...ivrMenus.flatMap((m) => [IvrCache.invalidateMenu(m.id), IvrCache.invalidateByCompany(m.companyId)]),
    ])
}
