import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '../../lib/prisma'
import { getCompanyById, type CompanyDto } from '../companies/companies.service'
import { AudiosCache } from './cache/audios.cache'
import { audioSoundDir, audioSoundPath } from '../../asterisk/audio.repository'
import { AnnouncementRepository } from '../../asterisk/announcement.repository'
import { IvrRepository } from '../../asterisk/ivr.repository'
import { AsteriskQueueRepository, toAsteriskQueueName } from '../../asterisk/queue.repository'
import { AnnouncementsCache } from '../announcements/cache/announcements.cache'
import { IvrCache } from '../ivr/cache/ivr.cache'
import { QueuesCache } from '../queues/cache/queues.cache'
import { convertToAsteriskWav } from '../../utils/audio-convert'
import * as ElevenLabsProvider from './providers/elevenlabs.provider'
import type { UpdateAudioInput } from './schemas/audio.schema'
import { AppError } from '../../utils/errors/app.error'

const select = {
    id: true,
    name: true,
    companyId: true,
    source: true,
    ttsText: true,
    ttsVoiceId: true,
    createdAt: true,
    updatedAt: true,
} as const

// Escreve o buffer em tmp e converte pro WAV final do Asterisk — usado tanto por upload quanto
// por TTS. Em caso de falha na conversão, apaga o registro já criado (rollback).
const persistAudioFile = async (company: Pick<CompanyDto, 'asteriskId'>, audioId: string, buffer: Buffer, ext: string) => {
    const dir = audioSoundDir(company.asteriskId)
    const soundPath = audioSoundPath(company.asteriskId, audioId)
    const tmpPath = join(tmpdir(), `audio-upload-${randomUUID()}${ext}`)

    await mkdir(dir, { recursive: true })
    await writeFile(tmpPath, buffer)
    try {
        await convertToAsteriskWav(tmpPath, `${soundPath}.wav`)
    } catch (error) {
        await prisma.audio.delete({ where: { id: audioId } }).catch(() => {})
        throw error
    } finally {
        await rm(tmpPath, { force: true })
    }
}

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
    await persistAudioFile(company, created.id, audio, extname(originalFilename))

    await AudiosCache.invalidateByCompany(companyId)
    return created
}

export const createAudioFromText = async (companyId: string, name: string, text: string, voiceId: string, language: 'pt' | 'en') => {
    const company = await getCompanyById(companyId)
    if (!company.elevenLabsApiKey) throw new AppError('ElevenLabs is not configured for this company', 400)

    const existing = await prisma.audio.findUnique({ where: { name_companyId: { name, companyId } } })
    if (existing) throw new AppError('Audio already exists for this company', 409)

    const buffer = await ElevenLabsProvider.textToSpeech(company.elevenLabsApiKey.trim(), voiceId, text, language)

    const created = await prisma.audio.create({
        data: { name, companyId, source: 'TTS', ttsText: text, ttsVoiceId: voiceId },
        select,
    })
    await persistAudioFile(company, created.id, buffer, '.mp3')

    await AudiosCache.invalidateByCompany(companyId)
    return created
}

const VOICE_PREVIEW_TEXT: Record<'pt' | 'en', string> = {
    pt: 'Olá! Esta é uma prévia da minha voz em português.',
    en: 'Hello! This is a preview of my voice in English.',
}

export const previewVoiceAudio = async (companyId: string, voiceId: string, language: 'pt' | 'en') => {
    const company = await getCompanyById(companyId)
    if (!company.elevenLabsApiKey) throw new AppError('ElevenLabs is not configured for this company', 400)

    const cached = await AudiosCache.getVoicePreview(companyId, voiceId, language)
    if (cached) return Buffer.from(cached, 'base64')

    const buffer = await ElevenLabsProvider.textToSpeech(
        company.elevenLabsApiKey.trim(),
        voiceId,
        VOICE_PREVIEW_TEXT[language],
        language
    )
    await AudiosCache.setVoicePreview(companyId, voiceId, language, buffer.toString('base64'))
    return buffer
}

export const listVoices = async (companyId: string, forceRefresh = false) => {
    const company = await getCompanyById(companyId)
    if (!company.elevenLabsApiKey) throw new AppError('ElevenLabs is not configured for this company', 400)

    if (!forceRefresh) {
        const cached = await AudiosCache.getVoices(companyId)
        if (cached) return cached
    }

    const voices = await ElevenLabsProvider.listVoices(company.elevenLabsApiKey.trim())
    await AudiosCache.setVoices(companyId, voices)
    return voices
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

    const [announcements, ivrMenus, queuesWithAudio] = await Promise.all([
        prisma.announcement.findMany({ where: { audioId: id }, select: { id: true, companyId: true } }),
        prisma.ivrMenu.findMany({ where: { audioId: id }, select: { id: true, companyId: true } }),
        prisma.queue.findMany({
            where: { OR: [{ announce: id }, { periodicAnnounce: id }, { agentAnnounce: id }] },
            select: {
                id: true, name: true, number: true, companyId: true,
                announce: true, periodicAnnounce: true, agentAnnounce: true,
                company: { select: { asteriskId: true } },
            },
        }),
    ])

    await prisma.$transaction(async (tx) => {
        await tx.audio.delete({ where: { id } })
        // FK onDelete:SetNull já zera Queue.announce/periodicAnnounce/agentAnnounce no Prisma —
        // mas a tabela realtime do Asterisk (queues) guarda o path absoluto resolvido, não o
        // audioId, e não tem relação com Audio, então precisa ser zerada manualmente aqui.
        // `announce` (join, tocado pro caller) não tem coluna realtime — é um Playback no
        // dialplan, resolvido via regenerate() abaixo. `periodicAnnounce`/`agentAnnounce` viram
        // as colunas realtime `periodicAnnounce`/`announce`, respectivamente
        for (const q of queuesWithAudio) {
            const update: Record<string, null> = {}
            if (q.periodicAnnounce === id) update.periodicAnnounce = null
            if (q.agentAnnounce === id) update.announce = null
            if (Object.keys(update).length > 0) {
                const name = toAsteriskQueueName(q.company.asteriskId, q.number ?? q.name)
                await AsteriskQueueRepository.updateQueue(tx, q.id, name, name, update)
            }
        }
    })

    if (announcements.length > 0) await AnnouncementRepository.regenerate(existing.companyId)
    if (ivrMenus.length > 0) await IvrRepository.regenerate(existing.companyId)
    const queueDialplanCompanyIds = [...new Set(queuesWithAudio.filter((q) => q.announce === id).map((q) => q.companyId))]
    for (const companyId of queueDialplanCompanyIds) await AsteriskQueueRepository.regenerate(companyId)
    await rm(`${audioSoundPath(existing.company.asteriskId, id)}.wav`, { force: true })

    await Promise.all([
        AudiosCache.invalidateAudio(id),
        AudiosCache.invalidateByCompany(existing.companyId),
        ...announcements.flatMap((a) => [AnnouncementsCache.invalidateAnnouncement(a.id), AnnouncementsCache.invalidateByCompany(a.companyId)]),
        ...ivrMenus.flatMap((m) => [IvrCache.invalidateMenu(m.id), IvrCache.invalidateByCompany(m.companyId)]),
        ...queuesWithAudio.flatMap((q) => [QueuesCache.invalidateQueue(q.id), QueuesCache.invalidateByCompany(q.companyId)]),
    ])
    if (queuesWithAudio.length > 0) await QueuesCache.invalidateNamespace()
}
