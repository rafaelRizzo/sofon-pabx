import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as RatingsService from './ratings.service'
import {
    ratingQuerySchema,
    ratingExportQuerySchema,
    ratingIdParamSchema,
    ratingRecordingQuerySchema,
    createRatingSchema,
} from './schemas/call-rating.schema'
import { getCompanyById } from '../../companies/companies.service'
import { handleError } from '../../../utils/errors/handler.error'
import { AppError } from '../../../utils/errors/app.error'

// mesmo guard de path traversal do cdr.controller.ts - MixMonitor sempre grava sob esse diretório
const MONITOR_BASE_DIR = '/var/spool/asterisk/monitor'

export const getRatings = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = ratingQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({ success: true, ...(await RatingsService.getRatingsByCompany(query)) })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

const CSV_HEADER = ['Data/Hora', 'Ramal', 'Número', 'Nota atendimento', 'Nota serviço', 'Gravação']

function csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
}

function formatDateTimeBR(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0')
    const mo = (date.getMonth() + 1).toString().padStart(2, '0')
    const y = date.getFullYear()
    const h = date.getHours().toString().padStart(2, '0')
    const mi = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')
    return `${d}/${mo}/${y} ${h}:${mi}:${s}`
}

async function* generateRatingExportCsv(
    company: Parameters<typeof RatingsService.iterateRatingExportRecords>[0],
    query: Parameters<typeof RatingsService.iterateRatingExportRecords>[1]
): AsyncGenerator<string> {
    yield `﻿${CSV_HEADER.map(csvCell).join(',')}\n`
    for await (const batch of RatingsService.iterateRatingExportRecords(company, query)) {
        for (const record of batch) {
            const row = [
                formatDateTimeBR(record.createdAt),
                record.extension ? `${record.extension.alias} - ${record.extension.name}` : record.extensionId,
                record.number,
                record.scoreAtendimento != null ? String(record.scoreAtendimento) : '-',
                record.scoreServico != null ? String(record.scoreServico) : '-',
                record.hasRecording ? 'Sim' : 'Não',
            ]
            yield `${row.map(csvCell).join(',')}\n`
        }
    }
}

export const exportRatings = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = ratingExportQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        // resolve a empresa (404 se não existir) antes de abrir o stream - mesmo motivo de
        // cdr.controller.ts/exportCdr: erro não pode estourar no meio de uma resposta já iniciada
        const company = await getCompanyById(query.companyId)

        reply.header('Content-Disposition', 'attachment; filename="notas-de-atendimento.csv"')
        reply.type('text/csv; charset=utf-8')
        return reply.send(Readable.from(generateRatingExportCsv(company, query)))
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getRatingRecording = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = ratingIdParamSchema.parse(req.params)
        const { companyId } = ratingRecordingQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)

        const filePath = await RatingsService.getRatingRecordingPath(id, companyId)

        const resolved = path.resolve(filePath)
        if (!resolved.startsWith(MONITOR_BASE_DIR)) {
            throw new AppError('Recording not found', 404)
        }

        try {
            await stat(resolved)
        } catch {
            throw new AppError('Recording not found', 404)
        }

        reply.header('Content-Disposition', `attachment; filename="${path.basename(resolved)}"`)
        reply.type('audio/wav')
        return reply.send(createReadStream(resolved))
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createRating = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createRatingSchema.parse(req.body)
        req.scope.assertAccess(data.companyId)
        const rating = await RatingsService.createRating(data)
        return reply.status(201).send({ success: true, message: 'Rating created successfully', ratingId: rating.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
