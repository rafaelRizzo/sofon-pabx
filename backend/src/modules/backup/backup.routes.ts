import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as Controller from './backup.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import { backupExportQuerySchema, backupRestoreSchema, RestoreBackupResponse } from './schemas/backup.schema'
import { errors } from '../../schemas/responses'

// Backup embute segredo em texto puro (senha de tronco, token de integração, .wav de áudio em
// base64) — corpo de restore pode ficar grande com várias empresas/áudios, então essa rota tem
// bodyLimit próprio, maior que o default de 1MB do Fastify (ver app.ts)
const RESTORE_BODY_LIMIT = 100 * 1024 * 1024

export const backupRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get(
        '/backup/export',
        {
            onRequest: [...protectedRoute, requirePermission('backup', 'view')],
            schema: {
                tags: ['Backup'],
                summary: 'Exportar backup de configuração (por empresa ou de todas)',
                description:
                    'Query opcional: ?companyId. Com companyId, exporta só aquela empresa (reseller/user com permissão só acessam empresas do próprio escopo). ' +
                    'Sem companyId, exporta TODAS as empresas do sistema — admin only, já que o arquivo inclui segredo (senha de tronco, token de integração) ' +
                    'de toda empresa. Retorna um .json autocontido (áudios em base64) com todas as configs, incluindo fluxos (Flows).',
                security: [{ bearerAuth: [] }],
                querystring: backupExportQuerySchema,
                response: {
                    401: errors[401],
                    403: errors[403],
                    404: errors[404]
                }
            }
        },
        Controller.exportBackup as any
    )

    router.post(
        '/backup/restore',
        {
            bodyLimit: RESTORE_BODY_LIMIT,
            onRequest: [...protectedRoute, requireAdmin],
            schema: {
                tags: ['Backup'],
                summary: 'Restaurar backup de configuração (cria empresa(s) nova(s))',
                description:
                    'Recebe o .json gerado por GET /backup/export. Cada empresa do arquivo é recriada do zero (nunca sobrescreve uma empresa existente) ' +
                    'com todos os ids remapeados internamente — inclusive referências cruzadas entre entidades (destinos de rota, nós de Flow). ' +
                    'Falha em uma empresa não interrompe o restore das demais; a empresa que falhou é apagada (cascade) e reportada em `results`. ' +
                    'Admin only. Limitações: senha de ramal (Extension) é sempre regenerada, nunca preservada 1:1.',
                security: [{ bearerAuth: [] }],
                body: backupRestoreSchema,
                response: {
                    200: RestoreBackupResponse,
                    401: errors[401],
                    403: errors[403]
                }
            }
        },
        Controller.restoreBackup as any
    )
}
