import type { FastifyRequest, FastifyReply } from 'fastify'
import * as AudiosService from './audios.service'
import { createAudioFieldsSchema, updateAudioSchema, idParamSchema, companyQuerySchema } from './schemas/audio.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

const AUDIO_MIME_PREFIX = 'audio/'

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

// multipart: campos de texto (name, companyId) precisam vir ANTES do arquivo no form —
// @fastify/multipart só popula file.fields com as partes já lidas até o file() ser resolvido
export const createAudio = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const file = await req.file()
        if (!file) throw new AppError('No audio file sent', 400)
        if (!file.mimetype.startsWith(AUDIO_MIME_PREFIX)) throw new AppError('File must be an audio file', 400)

        const { name, companyId } = createAudioFieldsSchema.parse({
            name: file.fields.name && 'value' in file.fields.name ? file.fields.name.value : undefined,
            companyId: file.fields.companyId && 'value' in file.fields.companyId ? file.fields.companyId.value : undefined,
        })
        req.scope.assertAccess(companyId)

        const buffer = await file.toBuffer()
        if (buffer.length === 0) throw new AppError('Empty audio file', 400)

        const audio = await AudiosService.createAudio(companyId, name, buffer, file.filename)
        return reply.status(201).send({ success: true, message: 'Audio created successfully', audioId: audio.id })
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
