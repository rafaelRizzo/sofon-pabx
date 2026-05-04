import type { FastifyRequest, FastifyReply } from 'fastify'
import { createUserSchema, updateUserSchema, idParamSchema } from './schemas/user.schema'
import * as UserService from './user.service'
import { handleError } from '../../utils/handlers/handler.errors'
import { getLoggedUser } from '../../utils/handlers/handler.req.user'

export const getUsers = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id, role } = getLoggedUser(req)

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'You do not have permission to list all users'
            })
        }

        const users = await UserService.getAllUsers()

        return reply.send({
            success: true,
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

        if (role !== 'admin' && id !== loggedUserId) {
            return reply.status(403).send({
                success: false,
                message: 'You cannot view another user'
            })
        }

        const user = await UserService.getUserById(id)
        if (!user) return reply.status(404).send({
            success: false,
            message: 'User not found'
        })

        return reply.send({
            success: true,
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
        if (usersCount > 0) {
            return reply.status(403).send({
                success: false,
                message: 'The first user already exists'
            })
        }

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

        if (role !== 'admin') {
            return reply.status(403).send({
                success: false,
                message: 'Only admins can create users'
            })
        }

        const user = await UserService.createUser(data)
        if (!user) {
            return reply.status(500).send({
                success: false,
                message: 'Failed to create user'
            })
        }

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

        const existingUser = await UserService.getUserById(id)
        if (!existingUser) {
            return reply.status(404).send({
                success: false,
                message: 'User not found'
            })
        }

        if (role !== 'admin') {
            if (id !== loggedUserId) {
                return reply.status(403).send({
                    success: false,
                    message: 'You cannot update another user'
                })
            }

            const restrictedStatuses = ['blocked', 'inactive']
            if (data.status && restrictedStatuses.includes(data.status)) {
                return reply.status(403).send({
                    success: false,
                    message: `You cannot set user status to ${data.status}`
                })
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
        const { role, id: loggedUserId } = getLoggedUser(req)

        if (role !== 'admin' && id !== loggedUserId) {
            return reply.status(403).send({
                success: false,
                message: 'You cannot delete another user'
            })
        }

        const user = await UserService.deleteUser(id)
        if (!user) return reply.status(404).send({
            success: false,
            message: 'User not found'
        })

        return reply.send({
            success: true,
            message: 'User deleted successfully'
        })
    } catch (error) {
        return handleError(reply, error)
    }
}