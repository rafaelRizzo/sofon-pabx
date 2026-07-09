import { prisma } from '../../lib/prisma'
import { UsersCache } from './cache/users.cache'
import { CompaniesCache } from '../companies/cache/companies.cache'
import type { CreateUserInput, UpdateUserInput } from './schemas/user.schema'
import argon2 from 'argon2'
import { AppError } from '../../utils/errors/app.error'

const userSelect = {
    id: true,
    webhookSlug: true,
    name: true,
    username: true,
    role: true,
    status: true,
    extensionId: true,
    createdBy: true,
    companies: { select: { company: { select: { id: true, name: true } } } },
    createdAt: true,
    updatedAt: true,
} as const

const mapUser = <T extends { companies: { company: { id: string; name: string } }[] }>(user: T) => ({
    ...user,
    companies: user.companies.map((uc) => uc.company),
})

export const getAllUsers = async (options?: { createdBy?: string }) => {
    if (options?.createdBy) {
        const cached = await UsersCache.getUsersByCreatedBy(options.createdBy)
        if (cached) return cached

        const users = (await prisma.user.findMany({
            where: { createdBy: options.createdBy },
            select: userSelect,
        })).map(mapUser)

        await UsersCache.setUsersByCreatedBy(options.createdBy, users)
        return users
    }

    const cached = await UsersCache.getAllUsers()
    if (cached) return cached

    const users = (await prisma.user.findMany({ select: userSelect })).map(mapUser)
    await UsersCache.setAllUsers(users)
    return users
}

export const getUserById = async (id: string) => {
    const cached = await UsersCache.getUser(id)
    if (cached) return cached

    const found = await prisma.user.findUnique({
        where: { id },
        select: userSelect,
    })

    if (!found) {
        throw new AppError('User not found', 404)
    }

    const user = mapUser(found)
    await UsersCache.setUser(id, user)
    return user
}

export const createUser = async (data: CreateUserInput, createdBy?: string) => {
    const existing = await prisma.user.findUnique({ where: { username: data.username } })
    if (existing) {
        throw new AppError('Username already in use', 409)
    }

    const hashedPassword = await argon2.hash(data.password)

    const user = mapUser(await prisma.user.create({
        data: {
            ...data,
            password: hashedPassword,
            createdBy: createdBy ?? null,
        },
        select: userSelect,
    }))

    await UsersCache.invalidateAllUsers()
    if (createdBy) await UsersCache.invalidateUsersByCreatedBy(createdBy)
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

    const user = mapUser(await prisma.user.update({
        where: { id },
        data: updateData,
        select: userSelect,
    }))

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    if (existingUser.createdBy) await UsersCache.invalidateUsersByCreatedBy(existingUser.createdBy)
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
    if (user.createdBy) await UsersCache.invalidateUsersByCreatedBy(user.createdBy)
    return user
}
