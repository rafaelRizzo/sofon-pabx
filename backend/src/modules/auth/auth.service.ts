import { prisma } from '../../lib/prisma'
import { generateTokens, verifyRefreshToken } from '../../lib/jwt'
import { AppError } from '../../utils/errors/app.error'
import argon2 from 'argon2'
import type { LoginInput } from './schemas/auth.schema'
import type { CreateUserInput } from '../users/schemas/user.schema'

export const login = async (data: LoginInput) => {
    const user = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true, password: true, role: true, status: true },
    })

    if (!user) {
        throw new AppError('Username or password incorrect', 401)
    }

    const validPassword = await argon2.verify(user.password, data.password)
    if (!validPassword) {
        throw new AppError('Username or password incorrect', 401)
    }

    if (user.status !== 'active') {
        throw new AppError(`User account is ${user.status}`, 403)
    }

    return generateTokens({ id: user.id, role: user.role })
}

export const refreshAccessToken = async (refreshToken: string) => {
    try {
        const decoded = verifyRefreshToken(refreshToken)

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                status: true,
                role: true,
            },
        })

        if (!user || user.status !== 'active') {
            throw new AppError('User not found or inactive', 401)
        }

        const tokens = await generateTokens({
            id: user.id,
            role: user.role,
        })

        return tokens
    } catch (error) {
        throw new AppError('Token renewal failed', 401)
    }
}

export const register = async (data: CreateUserInput) => {
    const userCount = await prisma.user.count()
    if (userCount > 0) {
        throw new AppError('Registration is disabled', 403)
    }

    const existingUser = await prisma.user.findUnique({
        where: { username: data.username },
    })

    if (existingUser) {
        throw new AppError('User already exists', 409)
    }

    const hashedPassword = await argon2.hash(data.password)

    const user = await prisma.user.create({
        data: { ...data, password: hashedPassword, role: 'admin' },
        select: { id: true, role: true },
    })

    return generateTokens({ id: user.id, role: user.role })
}
