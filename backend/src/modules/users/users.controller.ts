import type { FastifyRequest, FastifyReply } from 'fastify'
import * as UsersService from './users.service'
import { createUserSchema, updateUserSchema, idParamSchema } from './schemas/user.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'
import { prisma } from '../../lib/prisma'

const assertSelfOrAdmin = (req: FastifyRequest, id: string) => {
    if (!req.scope.isAdmin && req.user!.id !== id) {
        throw new AppError('Forbidden', 403)
    }
}

export const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role, id } = req.user!
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

        // só admin/reseller criam usuários; não-admin só cria role "user" —
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

        // extensionId governa pause/unpause em filas — não-admin não pode vincular ramal fora do seu
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

export const deleteUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        await UsersService.deleteUser(id)

        return reply.send({
            success: true,
            message: 'User deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}
