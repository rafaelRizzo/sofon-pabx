import type { FastifyRequest, FastifyReply } from 'fastify'
import * as Service from './backup.service'
import { backupExportQuerySchema, backupRestoreSchema } from './schemas/backup.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

export const exportBackup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { companyId } = backupExportQuerySchema.parse(req.query)

        if (companyId) {
            req.scope.assertAccess(companyId)
        } else if (!req.scope.isAdmin) {
            // backup sem companyId inclui segredo (senha de tronco, token de integração) de
            // TODA empresa do sistema - reseller não vê isso nem pra suas próprias empresas
            throw new AppError('Exportar backup de todas as empresas requer admin', 403)
        }

        const backup = await Service.exportBackup(companyId)

        // Export não passa por nenhum create/update (só leitura), então não é capturado pela
        // extensão de audit log automática do Prisma (lib/prisma.ts) - sem isso, baixar um
        // arquivo com segredo em texto puro de toda empresa do sistema ficaria sem rastro nenhum
        await prisma.auditLog
            .create({
                data: {
                    actorId: req.user!.id,
                    action: 'EXPORT',
                    model: 'Backup',
                    recordId: companyId ?? null,
                    companyId: companyId ?? null,
                    after: { scope: companyId ? 'company' : 'all-companies', companies: backup.companies.length }
                }
            })
            .catch(() => {})

        const filename = companyId ? `backup-${companyId}.json` : 'backup-todas-empresas.json'
        reply.header('Content-Disposition', `attachment; filename="${filename}"`)
        reply.type('application/json')
        return reply.send(JSON.stringify(backup))
    } catch (e) {
        return handleError(reply, e, req)
    }
}

export const restoreBackup = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const input = backupRestoreSchema.parse(req.body)
        const results = await Service.restoreBackup(input.companies, req.user!.id, input.generatedAt)
        return reply.send({ success: true, message: 'Restore concluído', results })
    } catch (e) {
        return handleError(reply, e, req)
    }
}
