import { db } from '../../db/config/db'
import { users } from '../../db/schemas/users'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '../../utils/password-hasher/argon'
import { AppError } from '../../utils/handlers/app.error'
import { generateToken, verifyToken } from '../../utils/handlers/handler.jwt'
import type { AuthUserInput } from '../../modules/auth/schema/auth.schema'

export const authUser = async (data: AuthUserInput) => {
    const [user] = await db.select().from(users).where(eq(users.username, data.username))
    if (!user) throw new AppError('Usuário ou senha incorretos', 401)

    const validPassword = await verifyPassword(user.password, data.password)
    if (!validPassword) throw new AppError('Usuário ou senha incorretos', 401)

    if (user.status !== 'active') {
        await db.update(users)
            .set({ token: null })
            .where(eq(users.id, user.id))
        throw new AppError(`Conta do usuário está ${user.status}`, 403)
    }

    if (!user.token) {
        const token = await generateToken(user.id, user.role)
        await db.update(users).set({ token }).where(eq(users.id, user.id))
        return { token }
    }

    try {
        verifyToken(user.token)
        return { token: user.token }
    } catch {
        const token = await generateToken(user.id, user.role)
        await db.update(users).set({ token }).where(eq(users.id, user.id))
        return { token }
    }
}