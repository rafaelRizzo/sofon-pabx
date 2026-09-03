import type { FastifyRequest, FastifyReply } from 'fastify'
import { createWriteStream } from 'fs'
import { rm } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import * as MigrationsService from './migrations.service'
import { companyIdParamSchema } from './schemas/migration.schema'
import { AppError } from '../../utils/errors/app.error'
import { handleError } from '../../utils/errors/handler.error'
import { validateEnv } from '../../config/env'

const env = validateEnv()
// .sql: dump já extraído (pelo navegador ou manualmente, ver frontend/src/lib/issabel-extract.ts).
// .tar/.tgz/.gz: backup completo do Issabel - extraído no servidor via `tar` (ver archive.ts)
const ALLOWED_EXTENSIONS = new Set(['.sql', '.tar', '.tgz', '.gz'])

export const importIssabel = async (req: FastifyRequest, reply: FastifyReply) => {
    let tmpPath: string | undefined

    try {
        const { id: companyId } = companyIdParamSchema.parse(req.params)
        req.scope.assertAccess(companyId)

        const file = await req.file({ limits: { fileSize: env.MIGRATION_UPLOAD_MAX_SIZE_MB * 1024 * 1024 } })
        if (!file) throw new AppError('Arquivo de backup não enviado', 400)

        const ext = extname(file.filename).toLowerCase()
        if (!ALLOWED_EXTENSIONS.has(ext))
            throw new AppError('Formato de arquivo inválido - esperado o dump asterisk.sql ou o backup completo (.tar/.tgz)', 400)

        tmpPath = join(tmpdir(), `issabel-upload-${randomUUID()}${ext}`)
        await pipeline(file.file, createWriteStream(tmpPath))

        if (file.file.truncated)
            throw new AppError(`Arquivo excede o tamanho máximo permitido (${env.MIGRATION_UPLOAD_MAX_SIZE_MB}MB)`, 413)

        // migrationsService.importIssabelBackup apaga tmpPath no fim (sucesso ou erro) - daqui em
        // diante o arquivo já não é mais responsabilidade deste controller
        const uploadedPath = tmpPath
        tmpPath = undefined
        const summary = await MigrationsService.importIssabelBackup(companyId, uploadedPath)

        return reply.send({ success: true, summary })
    } catch (error) {
        if (tmpPath) await rm(tmpPath, { force: true }).catch(() => {})
        return handleError(reply, error, req)
    }
}
