import jwt from 'jsonwebtoken'

interface JwtPayload {
    id: string
    username: string
    role: string
}

export const generateToken = (payload: JwtPayload): string => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET as string,
        { expiresIn: '7d' }
    )
}

export const verifyToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload
    } catch (error) {
        return null
    }
}

export const isTokenValid = (token: string | null): boolean => {
    if (!token) return false
    return verifyToken(token) !== null
}