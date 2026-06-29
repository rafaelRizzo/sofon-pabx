import { prisma } from '../../lib/prisma'
import { UsersCache } from './cache/users.cache'
import { CompaniesCache } from '../companies/cache/companies.cache'
import type { CreateUserInput, UpdateUserInput } from './schemas/user.schema'
import argon2 from 'argon2'
import { AppError } from '../../utils/errors/app.error'

export const getAllUsers = async () => {
    const cached = await UsersCache.getAllUsers()
    if (cached) return cached

    const users = await prisma.user.findMany({
        select: {
            id: true,
            webhookSlug: true,
            name: true,
            username: true,
            role: true,
            status: true,
            extensionId: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await UsersCache.setAllUsers(users)
    return users
}

export const getUserById = async (id: string) => {
    const cached = await UsersCache.getUser(id)
    if (cached) return cached

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            webhookSlug: true,
            name: true,
            username: true,
            role: true,
            status: true,
            extensionId: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!user) {
        throw new AppError('User not found', 404)
    }

    await UsersCache.setUser(id, user)
    return user
}

export const createUser = async (data: CreateUserInput) => {
    const existing = await prisma.user.findUnique({ where: { username: data.username } })
    if (existing) {
        throw new AppError('Username already in use', 409)
    }

    const hashedPassword = await argon2.hash(data.password)

    const user = await prisma.user.create({
        data: {
            ...data,
            password: hashedPassword,
        },
        select: {
            id: true,
            webhookSlug: true,
            name: true,
            username: true,
            role: true,
            status: true,
            extensionId: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await UsersCache.invalidateAllUsers()
    return user
}

export const updateUser = async (id: string, data: UpdateUserInput) => {
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
        throw new AppError('User not found', 404)
    }

    const updateData = { ...data }
    if (data.password) {
        updateData.password = await argon2.hash(data.password)
    }

    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            webhookSlug: true,
            name: true,
            username: true,
            role: true,
            status: true,
            extensionId: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    return user
}

export const getCompaniesByUser = async (id: string) => {
    const cached = await CompaniesCache.getCompaniesByUser(id)
    if (cached) return cached

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
        throw new AppError('User not found', 404)
    }

    const companies = await prisma.company.findMany({
        where: { users: { some: { userId: id } } },
        select: {
            id: true,
            name: true,
            doc: true,
            asteriskId: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    await CompaniesCache.setCompaniesByUser(id, companies)
    return companies
}

export const deleteUser = async (id: string) => {
    const user = await prisma.user.delete({
        where: { id },
    })

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    return user
}
