import { db } from '../../db/config/db'
import { users } from '../../db/schemas/users'
import { refreshTokens } from '../../db/schemas/refresh-tokens'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '../../utils/password-hasher/argon'
import { AppError } from '../../utils/handlers/app.error'
import { generateToken, verifyRefreshToken, refreshTokenPair, decodeToken } from '../../utils/jwt/handler.jwt'
import { TransactionHelper } from '../../utils/db/transaction.helper'
import { logger } from '../../utils/logger'
import type { AuthUserInput } from '../../modules/auth/schemas/auth.schema'

export const authUser = async (data: AuthUserInput) => {
    const [user] = await db.select().from(users).where(eq(users.username, data.username))
    if (!user) throw new AppError('Username or password incorrect', 401)

    const validPassword = await verifyPassword(user.password, data.password)
    if (!validPassword) throw new AppError('Username or password incorrect', 401)

    if (user.status !== 'active') {
        throw new AppError(`User account is ${user.status}`, 403)
    }

    const tokens = await generateToken(user.id, user.role)
    const decoded = decodeToken(tokens.refreshToken)

    try {
        await TransactionHelper.execute(
            async () => {
                await db.update(users)
                    .set({ token: tokens.token })
                    .where(eq(users.id, user.id))

                await db.insert(refreshTokens)
                    .values({
                        user_id: user.id,
                        token_jti: decoded.jti,
                        expires_at: new Date(decoded.exp! * 1000),
                    })
            },
            [{ namespace: 'users', pattern: user.id }]
        )
    } catch (error) {
        logger.error({ event: 'auth.refresh.token.save.error', error: (error as Error).message })
        throw error
    }

    return tokens
}

export const refreshAuth = async (refreshToken: string) => {
    try {
        const decoded = await verifyRefreshToken(refreshToken)
        const [user] = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.id, decoded.id))

        if (!user) {
            throw new AppError('User not found', 401)
        }

        const tokens = await refreshTokenPair(refreshToken, user.role)
        const decodedNew = decodeToken(tokens.refreshToken)

        try {
            await TransactionHelper.execute(
                async () => {
                    await db.update(users)
                        .set({ token: tokens.token })
                        .where(eq(users.id, user.id))

                    await db.delete(refreshTokens)
                        .where(eq(refreshTokens.token_jti, decoded.jti))

                    await db.insert(refreshTokens)
                        .values({
                            user_id: user.id,
                            token_jti: decodedNew.jti,
                            expires_at: new Date(decodedNew.exp! * 1000),
                        })
                },
                [{ namespace: 'users', pattern: user.id }]
            )
        } catch (error) {
            logger.error({ event: 'auth.refresh.token.renew.error', error: (error as Error).message })
            throw error
        }

        return tokens
    } catch (error) {
        throw new AppError('Token renewal failed', 401)
    }
}