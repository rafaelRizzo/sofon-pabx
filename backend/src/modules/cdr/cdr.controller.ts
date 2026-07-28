import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './cdr.service'
import {
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
