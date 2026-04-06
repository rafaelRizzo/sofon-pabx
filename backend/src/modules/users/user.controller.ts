import type { FastifyRequest, FastifyReply } from 'fastify'
import { createUserSchema, updateUserSchema, idParamSchema } from './schema/user.schema'
import * as UserService from './user.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'
import { requireAdmin, requireSelfOrAdmin } from '../../utils/handlers/handler.permissions'
import { AppError } from '../../utils/handlers/app.error'

export const getUsers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { role } = getLoggedUser(req)
        requireAdmin(role)

        const users = await UserService.getAllUsers()
        return reply.send({
            success: true,
            message: "Users fetched successfully",
            users
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const getUserById = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role, id: loggedUserId } = getLoggedUser(req)
        requireSelfOrAdmin(role, id, loggedUserId)

        const user = await UserService.getUserById(id)
        if (!user) throw new AppError('User not found', 404)

        return reply.send({
            success: true,
            message: 'User fetched successfully',
            user
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const createFirstUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createUserSchema.parse(req.body)
        data.role = 'admin'

        const usersCount = await UserService.countUsers()
        if (usersCount > 0) throw new AppError('The first user already exists', 403)

        const user = await UserService.createUser(data)
        return reply.status(201).send({
            success: true,
            message: 'First user created successfully',
            user
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const createUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = createUserSchema.parse(req.body)
        const { role } = getLoggedUser(req)
        requireAdmin(role)

        const user = await UserService.createUser(data)
        if (!user) throw new AppError('Failed to create user', 500)

        return reply.status(201).send({
            success: true,
            message: 'User created successfully',
            user_id: user.id
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const updateUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const data = updateUserSchema.parse(req.body)
        const { role, id: loggedUserId } = getLoggedUser(req)
        requireSelfOrAdmin(role, id, loggedUserId)

        if (role !== 'admin') {
            const restrictedStatuses = ['blocked', 'inactive']
            if (data.status && restrictedStatuses.includes(data.status)) {
                throw new AppError(`You cannot set user status to ${data.status}`, 403)
            }
        }

        await UserService.updateUser(id, data)
        return reply.send({
            success: true,
            message: 'User updated successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}

export const deleteUser = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = idParamSchema.parse(req.params)
        const { role } = getLoggedUser(req)
        requireAdmin(role)

        const user = await UserService.deleteUser(id)
        if (!user) throw new AppError('User not found', 404)

        return reply.send({
            success: true,
            message: 'User deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}