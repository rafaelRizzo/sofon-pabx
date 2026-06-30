import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import * as UsersController from './users.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { createUserSchema, updateUserSchema, idParamSchema } from './schemas/user.schema'
import { errors, ok, deleted } from '../../schemas/responses'
import { UserSchema } from './schemas/user.schema'
import { CompanySchema } from '../companies/schemas/company.schema'

export const usersRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/users', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Users'],
            summary: 'Listar usuários',
            description: 'Admin vê todos. Reseller vê apenas os usuários que criou.',
            security: [{ bearerAuth: [] }],
            response: {
                200: ok({ message: z.string(), users: z.array(UserSchema) }),
                401: errors[401],
                403: errors[403],
            },
        },
    }, UsersController.getAllUsers as any)

    router.get('/users/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Users'],
            summary: 'Buscar usuário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ok({ message: z.string(), user: UserSchema }),
                401: errors[401],
                404: errors[404],
            },
        },
    }, UsersController.getUserById as any)

    router.get('/users/:id/companies', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Users'],
            summary: 'Listar empresas do usuário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: ok({ message: z.string(), companies: z.array(CompanySchema) }),
                401: errors[401],
                404: errors[404],
            },
        },
    }, UsersController.getCompaniesByUser as any)

    router.post('/users', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Users'],
            summary: 'Criar usuário',
            description: 'Admin pode criar qualquer role. Reseller só cria role "user" e o usuário fica vinculado a ele.',
            security: [{ bearerAuth: [] }],
            body: createUserSchema,
            response: {
                201: ok({ message: z.string(), user: UserSchema }),
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, UsersController.createUser as any)

    router.put('/users/:id', {
        onRequest: protectedRoute,
        schema: {
            tags: ['Users'],
            summary: 'Atualizar usuário',
            description: 'Mínimo 1 campo obrigatório.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateUserSchema,
            response: {
                200: ok({ message: z.string() }),
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, UsersController.updateUser as any)

    router.delete('/users/:id', {
        onRequest: [...protectedRoute, requireAdmin],
        schema: {
            tags: ['Users'],
            summary: 'Remover usuário',
            description: 'Requer role admin.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: deleted,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, UsersController.deleteUser as any)
}
