import { prisma } from '../lib/prisma'
import { redisClient } from '../config/redis'

export const setupTestEnv = async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect()
    }
    await redisClient.flushAll()
}

export const teardownTestEnv = async (usernamePrefix: string) => {
    await prisma.user.deleteMany({ where: { username: { startsWith: usernamePrefix } } })
    await prisma.$disconnect()
}
