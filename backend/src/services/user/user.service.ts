import type { UserRole } from '../../generated/prisma/enums'
import { prisma } from '../../lib/prisma'
import { hashPassword } from '../../utils/handler.bcrypt'
import { AppError } from '../../utils/handler.error'

type UserType = {
    name: string
    username: string
    password: string
    role?: UserRole
}

type UpdateUserType = {
    name?: string
    username?: string
    password?: string
    role?: string
    status?: boolean
}

export const userSelect = {
    id: true,
    name: true,
    username: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true
}

export class UserService {
    async createFirstUser(user: Omit<UserType, 'role'>) {
        const userCount = await prisma.user.count()

        if (userCount > 0) {
            throw new AppError('O primeiro usuário já foi criado', 401)
        }

        const hashedPassword = await hashPassword(user.password)

        return await prisma.user.create({
            data: {
                name: user.name,
                username: user.username,
                password: hashedPassword,
                role: 'admin'
            },
            select: userSelect
        })
    }

    async create(user: UserType) {
        const existingUser = await prisma.user.findUnique({
            where: {
                username: user.username
            }
        })

        if (existingUser) {
            throw new AppError('Username já existe', 401)
        }

        const hashedPassword = await hashPassword(user.password)

        const userCreatedData = await prisma.user.create({
            data: {
                name: user.name,
                username: user.username,
                password: hashedPassword,
                role: user?.role || 'agent'
            },
            select: userSelect
        })

        return userCreatedData
    }

    async list() {
        return await prisma.user.findMany({
            select: userSelect
        })
    }

    async getById(id: string) {
        const user = await prisma.user.findUnique({
            where: {
                id: id
            },
            select: userSelect
        })

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        return user
    }

    async update(id: string, data: UpdateUserType) {
        const updateData: any = {}

        if (data.name) updateData.name = data.name
        if (data.username) updateData.username = data.username
        if (data.password) updateData.password = await hashPassword(data.password)
        if (data.role) updateData.role = data.role
        if (data.status !== undefined) updateData.status = data.status

        return await prisma.user.update({
            where: {
                id: id
            },
            data: updateData,
            select: userSelect
        })
    }

    async delete(id: string) {
        const user = await prisma.user.findUnique({
            where: {
                id: id
            }
        })

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        await prisma.user.delete({
            where: {
                id: id
            }
        })

        return true
    }
}