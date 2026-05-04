import jwt from 'jsonwebtoken'
import { jtiManager } from './jti.cache'
import { v4 as uuidv4 } from 'uuid'

const SECRET = process.env.JWT_SECRET || 'seu-secret-key'
const JWT_EXP = process.env.JWT_EXP || '24h'

export const generateToken = async (userId: string, role: string) => {
    const jti = uuidv4()

    const token = jwt.sign(
        {
            id: userId,
            role,
            jti
        },
        SECRET,
        { expiresIn: JWT_EXP as jwt.SignOptions['expiresIn'] }
    )

    jtiManager.add(jti, userId)
    return token
}

export const verifyToken = (token: string) => {
    const decoded = jwt.verify(token, SECRET) as { id: string; role: string; jti: string }

    if (!jtiManager.exists(decoded.jti)) {
        throw new Error('Token revogado')
    }

    return decoded
}

export const revokeToken = (userId: string) => {
    jtiManager.revokeByUserId(userId)
}