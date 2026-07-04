import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { jtiManager } from './jti'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'

export interface TokenPayload {
    id: string
    role: string
    jti?: string
}

export const generateTokens = async (payload: TokenPayload) => {
    const jti = randomUUID()
    const tokenPayload = { ...payload, jti }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

    const { exp } = jwt.decode(token) as { exp: number }
    await jtiManager.add(jti, payload.id, exp - Math.floor(Date.now() / 1000))

    return { token, refreshToken }
}

export const verifyToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
}

export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, REFRESH_SECRET) as TokenPayload
}

export const decodeToken = (token: string) => {
    return jwt.decode(token) as any
}
