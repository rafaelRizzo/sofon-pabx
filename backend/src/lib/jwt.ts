import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { jtiManager } from './jti'
import { validateEnv } from '../config/env'

const env = validateEnv()
const JWT_SECRET = env.JWT_SECRET
const REFRESH_SECRET = env.REFRESH_SECRET
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN

export interface TokenPayload {
    id: string
    role: string
    jti?: string
    type?: 'access' | 'refresh'
}

// Gera access + refresh com JTIs distintos, cada um persistido no Redis com o TTL do próprio token —
// permite revogar o refresh no logout/rotação (antes só o access tinha JTI). Retorna refreshJti pra
// quem precisar rastrear a sessão.
export const generateTokens = async (payload: TokenPayload) => {
    const accessJti = randomUUID()
    const refreshJti = randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const token = jwt.sign(
        { id: payload.id, role: payload.role, jti: accessJti, type: 'access' },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    )
    const refreshToken = jwt.sign(
        { id: payload.id, role: payload.role, jti: refreshJti, type: 'refresh' },
        REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    )

    const { exp: accessExp } = jwt.decode(token) as { exp: number }
    const { exp: refreshExp } = jwt.decode(refreshToken) as { exp: number }
    await jtiManager.add(accessJti, payload.id, accessExp - now)
    await jtiManager.add(refreshJti, payload.id, refreshExp - now)

    return { token, refreshToken, refreshJti }
}

export const verifyToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload
}

export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }) as TokenPayload
}

export const decodeToken = (token: string) => {
    return jwt.decode(token) as any
}
