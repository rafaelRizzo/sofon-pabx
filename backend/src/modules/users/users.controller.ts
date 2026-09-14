import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { extname } from 'path'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as UsersService from './users.service'
import { createUserSchema, updateUserSchema, idParamSchema } from './schemas/user.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'
import { processAvatarImage } from './avatar-image'

const assertSelfOrAdmin = (req: FastifyRequest, id: string) => {
    if (!req.scope.isAdmin && req.user!.id !== id) {
        throw new AppError('Forbidden', 403)
    }
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

// extensão só decide o que TENTAMOS validar - quem decide se é aceito é processAvatarImage()
// lendo os bytes reais (mesmo aviso de audios.controller.ts). .gif nunca entra aqui mesmo que
// o cliente minta o Content-Type.
const ALLOWED_AVATAR_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])

export const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role, id } = req.user!
        if (role === 'user') {
            const user = await UsersService.getUserById(id)
            return reply.send({ success: true, message: 'Users fetched successfully', users: [user] })
        }
        const users = await UsersService.getAllUsers(
            role === 'reseller' ? { createdBy: id } : undefined
        )
        return reply.send({ success: true, message: 'Users fetched successfully', users })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getUserById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const user = await UsersService.getUserById(id)
        return reply.send({
            success: true,
            message: 'User fetched successfully',
            user,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const createUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role: requesterRole, id: requesterId } = req.user!
        const data = createUserSchema.parse(req.body)

        // só admin/reseller criam usuários; não-admin só cria role "user" -
        // sem isso, um "user" comum criava admin via POST /users (escalação de privilégio)
        if (requesterRole !== 'admin' && requesterRole !== 'reseller') {
            throw new AppError('Forbidden', 403)
        }
        if (requesterRole !== 'admin' && data.role !== 'user') {
            throw new AppError('Resellers can only create users with role "user"', 403)
        }

        // reseller só vincula o novo usuário a empresas do próprio escopo; sem isso, um reseller
        // poderia criar um usuário com acesso a empresas fora do seu escopo (IDOR)
        if (!req.scope.isAdmin) {
            data.companyIds.forEach((companyId) => req.scope.assertAccess(companyId))
        }

        const createdBy = requesterRole !== 'admin' ? requesterId : undefined
        const user = await UsersService.createUser(data, createdBy)

        return reply.status(201).send({ success: true, message: 'User created successfully', userId: user.id })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const data = updateUserSchema.parse(req.body)

        // só admin altera permissions; sem isso, um "user" editando o próprio perfil (assertSelfOrAdmin
        // permite self-edit) poderia se auto-conceder qualquer permissão (escalação de privilégio)
        if (data.permissions !== undefined && !req.scope.isAdmin) {
            throw new AppError('Forbidden', 403)
        }

        // extensionId governa pause/unpause em filas - não-admin não pode vincular ramal fora do seu
        // escopo de empresa (IDOR). Admin (companyIds null) pode qualquer um.
        if (data.extensionId && !req.scope.isAdmin) {
            const ext = await prisma.extension.findUnique({ where: { id: data.extensionId }, select: { companyId: true } })
            if (!ext) throw new AppError('Extension not found', 404)
            req.scope.assertAccess(ext.companyId)
        }

        // mesma proteção de IDOR do create: reseller só vincula a empresas do próprio escopo
        if (data.companyIds && !req.scope.isAdmin) {
            data.companyIds.forEach((companyId) => req.scope.assertAccess(companyId))
        }

        await UsersService.updateUser(id, data)

        return reply.send({
            success: true,
            message: 'User updated successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const getCompaniesByUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const companies = await UsersService.getCompaniesByUser(id)
        return reply.send({
            success: true,
            message: 'Companies fetched successfully',
            companies,
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const uploadAvatar = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const file = await req.file({ limits: { fileSize: MAX_AVATAR_SIZE_BYTES } })
        if (!file) throw new AppError('No image sent', 400)

        const ext = extname(file.filename).toLowerCase()
        if (!ALLOWED_AVATAR_EXTENSIONS.has(ext)) {
            throw new AppError('File must be .png, .jpg or .jpeg', 400)
        }

        const buffer = await file.toBuffer()
        if (buffer.length === 0) throw new AppError('Empty file', 400)

        const processed = await processAvatarImage(buffer)
        const user = await UsersService.uploadAvatar(id, processed)

        return reply.send({ success: true, message: 'Avatar updated successfully', avatarUpdatedAt: user.avatarUpdatedAt })
    } catch (error) {
        // @fastify/multipart lança FST_REQ_FILE_TOO_LARGE (não é AppError/ZodError) quando o
        // stream ultrapassa o limits.fileSize acima - sem esse mapeamento, handleError cai no
        // branch genérico e devolve 500 em vez de uma mensagem acionável pro usuário
        if ((error as { code?: string })?.code === 'FST_REQ_FILE_TOO_LARGE') {
            return handleError(reply, new AppError('A imagem deve ter no máximo 5MB', 413), req)
        }
        return handleError(reply, error, req)
    }
}

export const getAvatarFile = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const filePath = await UsersService.getAvatarFilePath(id)
        try {
            await stat(filePath)
        } catch {
            throw new AppError('Avatar file not found', 404)
        }

        reply.header('Content-Disposition', `inline; filename="${id}.webp"`)
        reply.type('image/webp')
        return reply.send(createReadStream(filePath))
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteAvatarFile = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        await UsersService.deleteAvatar(id)
        return reply.send({ success: true, message: 'Avatar removed successfully' })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const deleteUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)

        if (req.user!.id === id) {
            throw new AppError('Cannot delete your own user', 400)
        }

        await UsersService.deleteUser(id)

        return reply.send({
            success: true,
            message: 'User deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
