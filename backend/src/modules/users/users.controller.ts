import type { FastifyRequest, FastifyReply } from 'fastify'
import * as UsersService from './users.service'
import { createUserSchema, updateUserSchema, idParamSchema } from './schemas/user.schema'
import { handleError } from '../../utils/errors/handler.error'
import { AppError } from '../../utils/errors/app.error'

const assertSelfOrAdmin = (req: FastifyRequest, id: string) => {
    if (!req.scope.isAdmin && req.user!.id !== id) {
        throw new AppError('Forbidden', 403)
    }
}

export const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const users = await UsersService.getAllUsers()
        return reply.send({
            success: true,
            message: 'Users fetched successfully',
            users
        })
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
        const data = createUserSchema.parse(req.body)
        const user = await UsersService.createUser(data)

        return reply.status(201).send({
            success: true,
            message: 'User created successfully',
            userId: user.id
        })
    } catch (error) {
        return handleError(reply, error, req)
    }
}

export const updateUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        assertSelfOrAdmin(req, id)

        const data = updateUserSchema.parse(req.body)
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
