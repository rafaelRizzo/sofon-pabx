import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import * as UsersController from './users.controller'
import { protectedRoute, requireAdmin } from '../../middleware/scope.middleware'
import { requirePermission } from '../../middleware/permission.middleware'
import {
    createUserSchema, updateUserSchema, idParamSchema,
    ListUsersResponse, GetUserResponse, GetUserCompaniesResponse, CreateUserResponse, UpdateUserResponse,
    UploadAvatarResponse, DeleteAvatarResponse,
} from './schemas/user.schema'
import { errors, deleted } from '../../schemas/responses'
import { validateEnv } from '../../config/env'

const env = validateEnv()
const avatarUploadRateLimit = {
    config: {
        rateLimit: {
            max: env.AVATAR_UPLOAD_RATE_LIMIT_MAX,
            timeWindow: env.AVATAR_UPLOAD_RATE_LIMIT_WINDOW,
        },
    },
}

export const usersRoutes = async (app: FastifyInstance) => {
    const router = app.withTypeProvider<ZodTypeProvider>()

    router.get('/users', {
        onRequest: [...protectedRoute, requirePermission('users', 'view')],
        schema: {
            tags: ['Users'],
            summary: 'Listar usuários',
            description: 'Admin vê todos. Reseller vê apenas os usuários que criou.',
            security: [{ bearerAuth: [] }],
            response: {
                200: ListUsersResponse,
                401: errors[401],
                403: errors[403],
            },
        },
    }, UsersController.getAllUsers as any)

    router.get('/users/:id', {
        onRequest: [...protectedRoute, requirePermission('users', 'view')],
        schema: {
            tags: ['Users'],
            summary: 'Buscar usuário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetUserResponse,
                401: errors[401],
                404: errors[404],
            },
        },
    }, UsersController.getUserById as any)

    router.get('/users/:id/companies', {
        onRequest: [...protectedRoute, requirePermission('users', 'view')],
        schema: {
            tags: ['Users'],
            summary: 'Listar empresas do usuário',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: GetUserCompaniesResponse,
                401: errors[401],
                404: errors[404],
            },
        },
    }, UsersController.getCompaniesByUser as any)

    router.post('/users', {
        onRequest: [...protectedRoute, requirePermission('users', 'manage')],
        schema: {
            tags: ['Users'],
            summary: 'Criar usuário',
            description: 'Admin pode criar qualquer role. Reseller só cria role "user" e o usuário fica vinculado a ele.',
            security: [{ bearerAuth: [] }],
            body: createUserSchema,
            response: {
                201: CreateUserResponse,
                401: errors[401],
                403: errors[403],
                409: errors[409],
            },
        },
    }, UsersController.createUser as any)

    router.put('/users/:id', {
        onRequest: [...protectedRoute, requirePermission('users', 'manage')],
        schema: {
            tags: ['Users'],
            summary: 'Atualizar usuário',
            description: 'Mínimo 1 campo obrigatório.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            body: updateUserSchema,
            response: {
                200: UpdateUserResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
                409: errors[409],
            },
        },
    }, UsersController.updateUser as any)

    router.post('/users/:id/avatar', {
        ...avatarUploadRateLimit,
        onRequest: [...protectedRoute, requirePermission('users', 'manage')],
        schema: {
            tags: ['Users'],
            summary: 'Enviar/substituir foto de perfil',
            description:
                'multipart/form-data com o campo `file`. Apenas PNG ou JPEG, até 5MB - GIF é ' +
                'sempre rejeitado, mesmo com extensão/mimetype forjado (o conteúdo real é validado ' +
                'e reprocessado no servidor). Substitui a foto anterior, se houver.',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            consumes: ['multipart/form-data'],
            response: {
                200: UploadAvatarResponse,
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
                413: errors[413],
                422: errors[422],
            },
        },
    }, UsersController.uploadAvatar as any)

    router.get('/users/:id/avatar', {
        onRequest: [...protectedRoute, requirePermission('users', 'view')],
        schema: {
            tags: ['Users'],
            summary: 'Baixar a foto de perfil',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, UsersController.getAvatarFile as any)

    router.delete('/users/:id/avatar', {
        onRequest: [...protectedRoute, requirePermission('users', 'manage')],
        schema: {
            tags: ['Users'],
            summary: 'Remover a foto de perfil',
            security: [{ bearerAuth: [] }],
            params: idParamSchema,
            response: {
                200: DeleteAvatarResponse,
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, UsersController.deleteAvatarFile as any)

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
                400: errors[400],
                401: errors[401],
                403: errors[403],
                404: errors[404],
            },
        },
    }, UsersController.deleteUser as any)
}
