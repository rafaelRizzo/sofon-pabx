import { type FastifyRequest, type FastifyReply } from 'fastify'
import { handleError } from '../../utils/handler.error'
import { hashPassword } from '../../utils/handler.bcrypt'
import { prisma } from '../../lib/prisma'

// Helper para selecionar campos sem password
const userSelect = {
    id: true,
    name: true,
    username: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

export const firstUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Check first user creation')

        const userCount = await prisma.user.count()

        if (userCount > 0) {
            return reply.code(400).send({
                success: false,
                message: 'O primeiro usuário já foi criado'
            })
        }

        request.log.info('Hashing password')
        const hashedPassword = await hashPassword(request.body.password)
        request.log.info('Hashing finished')

        request.log.info('Creating first user')

        const user = await prisma.user.create({
            data: {
                name: request.body.name,
                username: request.body.username,
                password: hashedPassword,
                role: 'admin'
            },
            select: userSelect
        })

        request.log.info('Finishing user creation')

        return reply.code(201).send({
            success: true,
            message: 'Usuário criado com sucesso',
            user
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao criar usuário')
    }
}

export const createUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Checking if user already exists')

        const existingUser = await prisma.user.findUnique({
            where: {
                username: request.body.username
            }
        })

        if (existingUser) {
            return reply.code(400).send({
                success: false,
                message: 'Username ou name já existe'
            })
        }

        request.log.info('Hashing password')
        const hashedPassword = await hashPassword(request.body.password)
        request.log.info('Hashing finished')

        request.log.info('Creating new user')

        const user = await prisma.user.create({
            data: {
                name: request.body.name,
                username: request.body.username,
                password: hashedPassword,
                role: request.body.role
            },
            select: userSelect
        })

        request.log.info('Finishing new user creation')

        return reply.code(201).send({
            success: true,
            message: 'Usuário criado com sucesso',
            user
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao criar usuário')
    }
}

export const listUsers = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info('Listing users')

        const users = await prisma.user.findMany({
            select: userSelect
        })

        return reply.code(200).send({
            success: true,
            users
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao listar usuários')
    }
}

export const getUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Getting user with id: ${request.params.id}`)

        const user = await prisma.user.findUnique({
            where: {
                id: request.params.id
            },
            select: userSelect
        })

        if (!user) {
            return reply.code(404).send({
                success: false,
                message: 'Usuário não encontrado'
            })
        }

        request.log.info('Finishing getting user')

        return reply.code(200).send({
            success: true,
            user: [user]
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao buscar usuário')
    }
}

export const updateUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Updating user with id: ${request.params.id}`)

        const updateData: any = {}

        if (request.body.name) updateData.name = request.body.name
        if (request.body.username) updateData.username = request.body.username
        if (request.body.password) updateData.password = await hashPassword(request.body.password)
        if (request.body.role) updateData.role = request.body.role
        if (request.body.status !== undefined) updateData.status = request.body.status

        const user = await prisma.user.update({
            where: {
                id: request.params.id
            },
            data: updateData,
            select: userSelect
        })

        request.log.info('Finishing user update')

        return reply.code(200).send({
            success: true,
            message: 'Usuário atualizado com sucesso'
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao atualizar usuário')
    }
}

export const deleteUser = async (request: any, reply: FastifyReply) => {
    try {
        request.log.info(`Deleting user with id: ${request.params.id}`)

        await prisma.user.delete({
            where: {
                id: request.params.id
            }
        })

        request.log.info('Finishing user deletion')

        return reply.code(200).send({
            success: true,
            message: 'Usuário deletado com sucesso'
        })
    } catch (error) {
        return handleError(request, reply, error, 'Erro ao deletar usuário')
    }
}