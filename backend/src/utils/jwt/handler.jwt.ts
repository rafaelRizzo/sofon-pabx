import jwt from 'jsonwebtoken'
import { jtiManager } from './jti.cache'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../db/config/db'
import { refreshTokens } from '../../db/schemas/refresh-tokens'
import { eq, lt } from 'drizzle-orm'

const SECRET = process.env.JWT_SECRET || 'seu-secret-key'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'seu-refresh-secret'
const JWT_EXP = process.env.JWT_EXP || '15m'
const JWT_REFRESH_EXP = process.env.JWT_REFRESH_EXP || '7d'

export interface DecodedToken {
    id: string
    role?: string
    jti: string
    exp?: number
}

export interface TokenPair {
    token: string
    refreshToken: string
}

export const decodeToken = (token: string): DecodedToken => {
    const decoded = jwt.decode(token) as DecodedToken
    if (!decoded) throw new Error('Token inválido')
    return decoded
}

export const generateToken = async (userId: bigint, role: string): Promise<TokenPair> => {
    const jti = uuidv4()
    const refreshJti = uuidv4()
    const userIdStr = userId.toString()

    const token = jwt.sign(
        {
            id: userIdStr,
            role,
            jti
        },
        SECRET,
        { expiresIn: JWT_EXP as jwt.SignOptions['expiresIn'] }
    )

    const refreshToken = jwt.sign(
        {
            id: userIdStr,
            jti: refreshJti
        },
        REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXP as jwt.SignOptions['expiresIn'] }
    )

    jtiManager.add(jti, userIdStr)
    jtiManager.addRefresh(refreshJti, userIdStr)

    return { token, refreshToken }
}

export const verifyToken = async (token: string) => {
    const decoded = jwt.verify(token, SECRET) as { id: string; role: string; jti: string }

    if (!(await jtiManager.exists(decoded.jti))) {
        throw new Error('Token revogado')
    }

    return decoded
}

export const verifyRefreshToken = async (refreshToken: string) => {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as DecodedToken

    const [token] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token_jti, decoded.jti))

    if (!token) {
        throw new Error('Refresh token revogado ou não encontrado')
    }

    if (new Date() > token.expires_at) {
        throw new Error('Refresh token expirado')
    }

    return decoded
}

export const refreshTokenPair = async (refreshToken: string, role: string): Promise<TokenPair> => {
    const decoded = await verifyRefreshToken(refreshToken)

    const newTokenPair = await generateToken(BigInt(decoded.id), role)
    await jtiManager.revokeRefresh(decoded.jti)

    return newTokenPair
}

export const revokeToken = (userId: string) => {
    jtiManager.revokeByUserId(userId)
}

export const revokeRefreshTokenByJti = async (jti: string) => {
    await db.delete(refreshTokens)
        .where(eq(refreshTokens.token_jti, jti))
}

export const cleanExpiredRefreshTokens = async () => {
    await db.delete(refreshTokens)
        .where(lt(refreshTokens.expires_at, new Date()))
}