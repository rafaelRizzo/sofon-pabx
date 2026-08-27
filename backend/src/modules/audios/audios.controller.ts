import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { extname } from 'path'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AudiosService from './audios.service'
import { createAudioFieldsSchema, createAudioTtsSchema, updateAudioSchema, idParamSchema, companyQuerySchema, voicePreviewQuerySchema } from './schemas/audio.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'
import { audioSoundPath } from '../../asterisk/audio.repository'

// extensão e mimetype vêm do cliente e são facilmente forjáveis: a extensão só decide o
// que TENTAMOS validar, quem decide se o upload é aceito é isValidAudioContent() abaixo,
// lendo os bytes reais do arquivo
const ALLOWED_AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.gsm'])

// GSM 06.10 é um bitstream cru sem header (frames de 33 bytes), não dá pra checar magic
// bytes, então validamos que o tamanho é múltiplo do frame size, mesma checagem que o
// Asterisk/ferramentas de conversão usam pra rejeitar arquivo gsm corrompido/inválido
function isValidAudioContent(ext: string, buffer: Buffer): boolean {
    if (ext === '.wav') {
        return (
            buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WAVE'
        )
    }
    if (ext === '.mp3') {
        if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return true
        const [b0, b1] = buffer
        return buffer.length >= 2 && b0 === 0xff && ((b1 ?? 0) & 0xe0) === 0xe0
    }
    if (ext === '.gsm') {
        return buffer.length > 0 && buffer.length % 33 === 0
    }
    return false
}

export const getAudios = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const audios = await AudiosService.getAudiosByCompany(companyId)
        return reply.send({ success: true, message: 'Audios fetched successfully', audios })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getAudioById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const owner = await prisma.audio.findUnique({ where: { id }, select: { companyId: true } })
        if (!owner) throw new AppError('Audio not found', 404)
        req.scope.assertAccess(owner.companyId)
        const audio = await AudiosService.getAudioById(id)
        return reply.send({ success: true, message: 'Audio fetched successfully', audio })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getAudioFile = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.audio.findUnique({
            where: { id },
            select: { companyId: true, company: { select: { asteriskId: true } } },
        })
        if (!existing) throw new AppError('Audio not found', 404)
        req.scope.assertAccess(existing.companyId)

        const filePath = `${audioSoundPath(existing.company.asteriskId, id)}.wav`
        try {
            await stat(filePath)
        } catch {
            throw new AppError('Audio file not found', 404)
        }

        reply.header('Content-Disposition', `inline; filename="${id}.wav"`)
        reply.type('audio/wav')
        return reply.send(createReadStream(filePath))
    } catch (error) {
        return handleError(reply, error, req)
    }
}

// multipart: campos de texto (name, companyId) precisam vir ANTES do arquivo no form —
// @fastify/multipart só popula file.fields com as partes já lidas até o file() ser resolvido
export const createAudio = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const file = await req.file()
        if (!file) throw new AppError('No audio file sent', 400)

        const ext = extname(file.filename).toLowerCase()
        if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
            throw new AppError('File must be .wav, .mp3 or .gsm', 400)
        }

        const { name, companyId } = createAudioFieldsSchema.parse({
            name: file.fields.name && 'value' in file.fields.name ? file.fields.name.value : undefined,
            companyId: file.fields.companyId && 'value' in file.fields.companyId ? file.fields.companyId.value : undefined,
        })
        req.scope.assertAccess(companyId)

        const buffer = await file.toBuffer()
        if (buffer.length === 0) throw new AppError('Empty audio file', 400)
        if (!isValidAudioContent(ext, buffer)) {
            throw new AppError('File content does not match a valid .wav/.mp3/.gsm file', 422)
        }

        const audio = await AudiosService.createAudio(companyId, name, buffer, file.filename)
        return reply.status(201).send({ success: true, message: 'Audio created successfully', audioId: audio.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createAudioTts = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { name, companyId, text, voiceId, language } = createAudioTtsSchema.parse(req.body)
        req.scope.assertAccess(companyId)
        const audio = await AudiosService.createAudioFromText(companyId, name, text, voiceId, language)
        return reply.status(201).send({ success: true, message: 'Audio generated successfully', audioId: audio.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getVoices = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = companyQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const voices = await AudiosService.listVoices(companyId)
        return reply.send({ success: true, message: 'Voices fetched successfully', voices })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getVoicePreview = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId, voiceId, language } = voicePreviewQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)
        const buffer = await AudiosService.previewVoiceAudio(companyId, voiceId, language)
        reply.type('audio/mpeg')
        return reply.send(buffer)
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateAudio = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateAudioSchema.parse(req.body)
        const existing = await prisma.audio.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Audio not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AudiosService.updateAudio(id, data)
        return reply.send({ success: true, message: 'Audio updated successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteAudio = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const existing = await prisma.audio.findUnique({ where: { id }, select: { companyId: true } })
        if (!existing) throw new AppError('Audio not found', 404)
        req.scope.assertAccess(existing.companyId)
        await AudiosService.deleteAudio(id)
        return reply.send({ success: true, message: 'Audio deleted successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
