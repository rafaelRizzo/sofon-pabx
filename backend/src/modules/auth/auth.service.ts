import { prisma } from '../../lib/prisma'
import { generateTokens, verifyRefreshToken } from '../../lib/jwt'
import { jtiManager } from '../../lib/jti'
import { AppError } from '../../utils/errors/app.error'
import argon2 from 'argon2'
import type { LoginInput, RegisterInput } from './schemas/auth.schema'

// Hash descartável usado quando o usuário não existe - roda argon2.verify mesmo assim pra igualar o
// tempo de resposta e não vazar existência de username por timing. Calculado sob demanda uma vez.
let dummyHash: string | null = null
const getDummyHash = async () => (dummyHash ??= await argon2.hash('timing-safe-dummy-password'))

export const login = async (data: LoginInput) => {
    const user = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true, password: true, role: true, status: true },
    })

    if (!user) {
        await argon2.verify(await getDummyHash(), data.password).catch(() => false)
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

        if (decoded.type !== 'refresh') throw new AppError('Invalid token type', 401)
        if (!decoded.jti) throw new AppError('Token revoked', 401)

        // consume atômico (GETDEL): garante que o mesmo refresh token nunca gera dois pares novos,
        // mesmo sob duas requests concorrentes (ex: duas abas do mesmo navegador refrescando junto)
        let consumed: string | null
        try {
            consumed = await jtiManager.consume(decoded.jti)
        } catch {
            // Redis fora do ar - não é o mesmo que "token revogado", não pode forçar logout
            throw new AppError('Auth service unavailable', 503)
        }
        if (!consumed) {
            throw new AppError('Token revoked', 401)
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, status: true, role: true },
        })

        if (!user || user.status !== 'active') {
            throw new AppError('User not found or inactive', 401)
        }

        return generateTokens({ id: user.id, role: user.role })
    } catch (error) {
        if (error instanceof AppError) throw error
        throw new AppError('Token renewal failed', 401)
    }
}

export const register = async (data: RegisterInput) => {
    // count + create numa transação serializável - sem isso, duas requisições concorrentes no bootstrap
    // (0 usuários) passariam ambas no check e criariam dois admins.
    const user = await prisma.$transaction(
        async (tx) => {
            const userCount = await tx.user.count()
            if (userCount > 0) throw new AppError('Registration is disabled', 403)

            const existingUser = await tx.user.findUnique({ where: { username: data.username } })
            if (existingUser) throw new AppError('User already exists', 409)

            const hashedPassword = await argon2.hash(data.password)
            return tx.user.create({
                data: { ...data, password: hashedPassword, role: 'admin' },
                select: { id: true, role: true },
            })
        },
        { isolationLevel: 'Serializable' },
    )

    return generateTokens({ id: user.id, role: user.role })
}
