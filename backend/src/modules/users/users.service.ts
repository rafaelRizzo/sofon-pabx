import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { prisma } from '../../lib/prisma'
import { UsersCache } from './cache/users.cache'
import { CompaniesCache } from '../companies/cache/companies.cache'
import type { CreateUserInput, UpdateUserInput } from './schemas/user.schema'
import argon2 from 'argon2'
import { AppError } from '../../utils/errors/app.error'
import { invalidateUserCompanyIds, invalidateUserPermissions } from '../../utils/auth/access'
import { jtiManager } from '../../lib/jti'
import { avatarDir, avatarPath, avatarTmpPath } from './avatar-storage'
import { randomUUID } from 'crypto'

const userSelect = {
    id: true,
    webhookSlug: true,
    name: true,
    username: true,
    role: true,
    status: true,
    permissions: true,
    extensionId: true,
    createdBy: true,
    notes: true,
    avatarUpdatedAt: true,
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

const assertCompaniesExist = async (companyIds: string[]) => {
    const found = await prisma.company.count({ where: { id: { in: companyIds } } })
    if (found !== companyIds.length) {
        throw new AppError('One or more companies not found', 404)
    }
}

export const createUser = async (data: CreateUserInput, createdBy?: string) => {
    const existing = await prisma.user.findUnique({ where: { username: data.username } })
    if (existing) {
        throw new AppError('Username already in use', 409)
    }

    const { companyIds, ...rest } = data
    await assertCompaniesExist(companyIds)

    const hashedPassword = await argon2.hash(rest.password)

    // usuário nasce vinculado a >=1 empresa (garantido pelo min(1) do schema); sem isso,
    // req.scope.companyIds fica [] e ele não enxerga nenhum recurso escopado por empresa
    const created = await prisma.$transaction(async (tx) => {
        let created: { id: string }
        try {
            created = await tx.user.create({
                data: { ...rest, password: hashedPassword, createdBy: createdBy ?? null },
                select: { id: true },
            })
        } catch (err) {
            // extensionId é @unique - outro usuário já vinculado a esse ramal
            if ((err as { code?: string })?.code === 'P2002') {
                throw new AppError('Ramal já vinculado a outro usuário', 409)
            }
            throw err
        }
        await tx.userCompany.createMany({
            data: companyIds.map((companyId) => ({ userId: created.id, companyId })),
        })
        return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect })
    })

    const user = mapUser(created)

    await UsersCache.invalidateAllUsers()
    if (createdBy) await UsersCache.invalidateUsersByCreatedBy(createdBy)
    return user
}

export const updateUser = async (id: string, data: UpdateUserInput) => {
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
        throw new AppError('User not found', 404)
    }

    const { companyIds, ...rest } = data
    if (companyIds) await assertCompaniesExist(companyIds)

    const updateData = { ...rest }
    if (data.password) {
        updateData.password = await argon2.hash(data.password)
    }

    const updated = await prisma.$transaction(async (tx) => {
        try {
            await tx.user.update({ where: { id }, data: updateData })
        } catch (err) {
            // extensionId é @unique - outro usuário já vinculado a esse ramal
            if ((err as { code?: string })?.code === 'P2002') {
                throw new AppError('Ramal já vinculado a outro usuário', 409)
            }
            throw err
        }

        // substitui a lista completa (nunca vazio, garantido pelo min(1) do schema quando enviado)
        if (companyIds) {
            await tx.userCompany.deleteMany({ where: { userId: id } })
            await tx.userCompany.createMany({ data: companyIds.map((companyId) => ({ userId: id, companyId })) })
        }

        return tx.user.findUniqueOrThrow({ where: { id }, select: userSelect })
    })

    const user = mapUser(updated)

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    if (existingUser.createdBy) await UsersCache.invalidateUsersByCreatedBy(existingUser.createdBy)
    if (data.permissions) await invalidateUserPermissions(id)
    if (companyIds) {
        await invalidateUserCompanyIds(id)
        await CompaniesCache.invalidateCompaniesByUser(id)
        await CompaniesCache.invalidateCompaniesForScope(id)
    }
    if (data.password || data.permissions !== undefined || companyIds) {
        await jtiManager.revokeByUserId(id)
    }
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

// já recebe o buffer processado (webp reencodado, ver avatar-image.ts) - só grava em disco e
// atualiza o carimbo. Escreve num tmp no MESMO diretório final e faz rename atômico: nunca deixa
// um arquivo parcial no path final se o processo cair no meio da escrita.
export const uploadAvatar = async (id: string, processedImage: Buffer) => {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new AppError('User not found', 404)

    await mkdir(avatarDir(), { recursive: true })
    const tmpPath = avatarTmpPath(id, randomUUID())
    await writeFile(tmpPath, processedImage)
    try {
        await rename(tmpPath, avatarPath(id))
    } catch (error) {
        await rm(tmpPath, { force: true })
        throw error
    }

    const updated = await prisma.user.update({ where: { id }, data: { avatarUpdatedAt: new Date() }, select: userSelect })

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    return mapUser(updated)
}

export const deleteAvatar = async (id: string) => {
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new AppError('User not found', 404)

    await rm(avatarPath(id), { force: true })
    await prisma.user.update({ where: { id }, data: { avatarUpdatedAt: null } })

    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
}

export const getAvatarFilePath = async (id: string) => {
    const user = await prisma.user.findUnique({ where: { id }, select: { avatarUpdatedAt: true } })
    if (!user || !user.avatarUpdatedAt) throw new AppError('Avatar not found', 404)
    return avatarPath(id)
}

export const deleteUser = async (id: string) => {
    const user = await prisma.user.delete({
        where: { id },
    })

    await rm(avatarPath(id), { force: true })
    await UsersCache.invalidateUser(id)
    await UsersCache.invalidateAllUsers()
    if (user.createdBy) await UsersCache.invalidateUsersByCreatedBy(user.createdBy)
    await jtiManager.revokeByUserId(id)
    return user
}
