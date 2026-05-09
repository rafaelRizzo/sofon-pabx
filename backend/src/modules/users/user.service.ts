import { db } from '../../db/config/db'
import { count, eq } from 'drizzle-orm'
import { users } from '../../db/schemas/users'
import { hashPassword } from '../../utils/password-hasher/argon'
import { AppError } from '../../utils/handlers/app.error'
import { TransactionHelper } from '../../utils/db/transaction.helper'
import { UsersCache } from './cache/users.cache'

import type {
    CreateUserInput,
    UpdateUserInput,
} from './schemas/user.schema'

const userSelect = {
    id: users.id,
    webhook_slug: users.webhook_slug,
    name: users.name,
    username: users.username,
    role: users.role,
    status: users.status,
    created_at: users.created_at,
    updated_at: users.updated_at,
}

export const countUsers = async () => {
    const result = await db.select({ count: count() }).from(users)
    return Number(result[0]?.count ?? 0)
}

export const getAllUsers = async () => {
    const cached = await UsersCache.getAllUsers()
    if (cached) return cached

    const result = await db.select(userSelect).from(users)
    await UsersCache.setAllUsers(result)

    return result
}

export const getUserById = async (id: string) => {
    const cached = await UsersCache.getUser(id)
    if (cached) return cached

    const [user] = await db
        .select(userSelect)
        .from(users)
        .where(eq(users.id, id))

    if (user) {
        await UsersCache.setUser(id, user)
    }

    return user ?? null
}

export const createUser = async (data: CreateUserInput) => {
    const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, data.username))

    if (existingUser) {
        throw new AppError('Usuario já cadastrado', 409)
    }

    const hashedPassword = await hashPassword(data.password)

    const [user] = await db
        .insert(users)
        .values({
            ...data,
            password: hashedPassword,
        })
        .returning(userSelect)

    await TransactionHelper.execute(
        async () => user,
        [{ namespace: 'users' }]
    )

    return user
}

export const updateUser = async (id: string, data: UpdateUserInput) => {
    const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))

    if (!existingUser) {
        throw new AppError('Usuario não encontrado', 404)
    }

    const updateData: Record<string, any> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.username !== undefined) updateData.username = data.username
    if (data.password !== undefined) {
        updateData.password = await hashPassword(data.password)
    }
    if (data.status !== undefined) updateData.status = data.status

    const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning(userSelect)

    await TransactionHelper.execute(
        async () => user,
        [{ namespace: 'users', pattern: id }, { namespace: 'users' }]
    )

    return user ?? null
}

export const deleteUser = async (id: string) => {
    const [user] = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning(userSelect)

    await TransactionHelper.execute(
        async () => user,
        [{ namespace: 'users', pattern: id }, { namespace: 'users' }]
    )

    return user ?? null
}