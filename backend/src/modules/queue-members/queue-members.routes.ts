import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as QueueMembersController from './queue-members.controller'
import { protectedRoute } from '../../middleware/scope.middleware'
import {
    addMemberSchema, updateMemberSchema, memberIdParamSchema, queueIdParamSchema,
    ListMembersResponse, AddMemberResponse, UpdateMemberResponse,
} from './schemas/queue-member.schema'
import { errors, deleted } from '../../schemas/responses'

export const queueMembersRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/queues/:id/members', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queue Members'],
            summary: 'Listar membros da fila',
            security: [{ bearerAuth: [] }],
            params: queueIdParamSchema,
            response: {
                200: ListMembersResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueueMembersController.getQueueMembers as any)

    router.post('/queues/:id/members', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queue Members'],
            summary: 'Adicionar membro',
            security: [{ bearerAuth: [] }],
            params: queueIdParamSchema,
            body: addMemberSchema,
            response: {
                201: AddMemberResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, QueueMembersController.addMember as any)

    router.put('/queues/:id/members/:memberId', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queue Members'],
            summary: 'Atualizar membro',
            description: 'Não-admin só pode pausar/retomar no próprio ramal.',
            security: [{ bearerAuth: [] }],
            params: memberIdParamSchema,
            body: updateMemberSchema,
            response: {
                200: UpdateMemberResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueueMembersController.updateMember as any)

    router.delete('/queues/:id/members/:memberId', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Queue Members'],
            summary: 'Remover membro',
            security: [{ bearerAuth: [] }],
            params: memberIdParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, QueueMembersController.removeMember as any)
}
