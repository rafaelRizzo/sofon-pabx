import jwt from 'jsonwebtoken'
import { db } from '../../db/config/db'
import { users } from '../../db/schemas/users'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET!

export const generateToken = async (userId: string, role: string) => {
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1d' })
    await db.update(users).set({ token }).where(eq(users.id, userId))
    return token
}

export const generateTokenNoDB = async (userId: string, role: string) => {
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1d' })
    return token
}

export const verifyToken = (token: string) => {
    return jwt.verify(token, JWT_SECRET)
}