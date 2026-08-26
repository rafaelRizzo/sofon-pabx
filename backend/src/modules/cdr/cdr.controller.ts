import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './cdr.service'
import { getCompanyById } from '../companies/companies.service'
import {
    cdrExportQuerySchema,
    cdrIdParamSchema,
    cdrMetricsQuerySchema,
    cdrQuerySchema,
    cdrRecordingQuerySchema
} from './schemas/cdr.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'

// MixMonitor sempre grava sob esse diretório (ver dialplan.repository.ts/outbound-routes.service.ts)
// — guard contra path traversal, mesmo o valor vindo do banco (nunca de input HTTP direto)
const MONITOR_BASE_DIR = '/var/spool/asterisk/monitor'

export const getCdr = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = cdrQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({
            success: true,
            ...(await Service.getCdrByCompany(query))
        })
    } catch (e) {
        return handleError(reply, e, req)
    }
}

export const getCdrMetrics = async (
    req: FastifyRequest,
    reply: FastifyReply
) => {
    try {
        const query = cdrMetricsQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        return reply.send({
            success: true,
            ...(await Service.getCdrMetricsByCompany(query))
        })
    } catch (e) {
        return handleError(reply, e, req)
    }
}

const DIRECTION_LABEL: Record<string, string> = {
    inbound: 'Entrada',
    outbound: 'Saída',
    internal: 'Interna',
    transfer: 'Transferência'
}

const STATUS_LABEL: Record<string, string> = {
    ANSWERED: 'Atendida',
    'NO ANSWER': 'Não atendida',
    BUSY: 'Ocupado',
    FAILED: 'Falha',
    CONGESTION: 'Congestionamento'
}

const CSV_HEADER = [
    'Data/Hora',
    'Tipo',
    'Origem',
    'Destino',
    'Fila',
    'Espera',
    'Atendido por',
    'Tronco',
    'Duração',
    'Status'
]

function csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
}

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

// startTime já vem formatado como "YYYY-MM-DDTHH:mm:ss±HH:mm" (hora local naive do CDR, ver
// formatNaiveLocalISOString) — extrai direto da string, sem reconverter via Date/tz do processo
function formatDateTimeBR(value: string | null): string {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (!match) return '-'
    const [, y, mo, d, h, mi, s] = match
    return `${d}/${mo}/${y} ${h}:${mi}:${s}`
}

async function* generateCdrExportCsv(
    company: Parameters<typeof Service.iterateCdrExportRecords>[0],
    query: Parameters<typeof Service.iterateCdrExportRecords>[1]
): AsyncGenerator<string> {
    yield `﻿${CSV_HEADER.map(csvCell).join(',')}\n`
    for await (const batch of Service.iterateCdrExportRecords(company, query)) {
        for (const record of batch) {
            const row = [
                formatDateTimeBR(record.startTime),
                record.direction
                    ? DIRECTION_LABEL[record.direction] ?? record.direction
                    : '-',
                record.originLabel || record.originExtension || record.src || '-',
                record.destinationLabel || record.dialedNumber || record.dst || '-',
                record.queueLabel ?? '-',
                formatDuration(record.queueWaitSeconds),
                record.answeredBy?.label ?? '-',
                record.trunkName ?? '-',
                formatDuration(record.billsec),
                record.callStatus
                    ? STATUS_LABEL[record.callStatus] ?? record.callStatus
                    : '-'
            ]
            yield `${row.map(csvCell).join(',')}\n`
        }
    }
}

export const exportCdr = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const query = cdrExportQuerySchema.parse(req.query)
        req.scope.assertAccess(query.companyId)
        // Resolve a empresa (404 se não existir) antes de abrir o stream — precisa acontecer
        // fora do generator, senão o erro estoura no meio de uma resposta já iniciada como 200
        const company = await getCompanyById(query.companyId)

        reply.header('Content-Disposition', 'attachment; filename="cdr.csv"')
        reply.type('text/csv; charset=utf-8')
        return reply.send(Readable.from(generateCdrExportCsv(company, query)))
    } catch (e) {
        return handleError(reply, e, req)
    }
}

export const getCdrRecording = async (
    req: FastifyRequest,
    reply: FastifyReply
) => {
    try {
        const { id } = cdrIdParamSchema.parse(req.params)
        const { companyId } = cdrRecordingQuerySchema.parse(req.query)
        req.scope.assertAccess(companyId)

        const filePath = await Service.getCdrRecordingPath(id, companyId)

        const resolved = path.resolve(filePath)
        if (!resolved.startsWith(MONITOR_BASE_DIR)) {
            throw new AppError('Recording not found', 404)
        }

        try {
            await stat(resolved)
        } catch {
            throw new AppError('Recording not found', 404)
        }

        reply.header(
            'Content-Disposition',
            `attachment; filename="${path.basename(resolved)}"`
        )
        reply.type('audio/wav')
        return reply.send(createReadStream(resolved))
    } catch (e) {
        return handleError(reply, e, req)
    }
}
