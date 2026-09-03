import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as MigrationsController from './migrations.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { companyIdParamSchema, ImportIssabelResponse } from './schemas/migration.schema'
import { errors } from '../../schemas/responses'

export const migrationsRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.post('/companies/:id/migrations/issabel', {
        onRequest: [...protectedRoute, requireAdmin],
        schema: {
            tags: ['Migrations'],
            summary: 'Importar ramais, filas e troncos de um backup do IssabelPBX',
            description:
                'multipart/form-data com um único campo de arquivo, aceitando dois formatos: o dump ' +
                '`asterisk.sql` já extraído (o frontend faz essa extração no navegador antes do upload, ' +
                'pra nunca subir o backup completo - que pode ter GBs de gravação/voicemail junto), ou o ' +
                '.tar/.tgz completo do backup do Issabel (contendo `mysqldb_asterisk.tgz`), extraído aqui ' +
                'no servidor via `tar` - útil pra quem chama a API direto, sem passar pelo navegador. Em ' +
                'ambos os casos só o dump do banco `asterisk` é usado (nunca o resto do backup) e importa ' +
                'pra empresa `:id` (já existente): ramais chan_sip (`devices`/`users`/`sip`), filas ' +
                '(`queues_config`/`queues_details`, ' +
                'incluindo membros `SIP/<ramal>`) e troncos (`trunks` + peer de `sip`/`iax`). ' +
                'Ramal sempre recebe uma senha nova gerada pelo sistema (nunca preserva o secret original - ' +
                'o número muda de formato e os telefones precisam ser reprovisionados de qualquer forma). ' +
                'Tronco é sempre importado com registrationMode="inbound" (sem registro de saída ativo) por ' +
                'segurança - ligar o registro real com o provedor é decisão manual posterior. Membro de fila ' +
                'do tipo "Agent/N" (login dinâmico do Issabel, sem ramal fixo) não tem equivalente hoje e é ' +
                'contado à parte (`queueMembers.skippedAgents`), não bloqueia o resto do import. Falha em um ' +
                'item específico (nome duplicado, dado inválido etc) não interrompe os demais - fica reportada ' +
                'em `warnings` na categoria correspondente. Admin only.',
            security: [{ bearerAuth: [] }],
            consumes: ['multipart/form-data'],
            params: companyIdParamSchema,
            response: {
                200: ImportIssabelResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
                413: errors[400],
                422: errors[422],
            },
        },
    }, MigrationsController.importIssabel as any)
}
