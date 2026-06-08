import { redisClient } from '../config/redis'
import { logger } from '../utils/logger'

const JTI_PREFIX = 'jti:'

export const jtiManager = {
    add: async (jti: string, userId: string, expiresIn: number = 15 * 60) => {
        try {
            await redisClient.setEx(`${JTI_PREFIX}${jti}`, expiresIn, userId)
            logger.info({
                event: 'jti.added',
                jti,
                userId,
            })
        } catch (err) {
            logger.error({
                event: 'jti.add_failed',
                jti,
                error: err instanceof Error ? err.message : String(err),
            })
            throw err
        }
    },

    exists: async (jti: string): Promise<boolean> => {
        try {
            const exists = await redisClient.exists(`${JTI_PREFIX}${jti}`)
            return exists === 1
        } catch (err) {
            logger.error({
                event: 'jti.check_failed',
                jti,
                error: err instanceof Error ? err.message : String(err),
            })
            return false
        }
    },

    revoke: async (jti: string) => {
        try {
            await redisClient.del(`${JTI_PREFIX}${jti}`)
            logger.info({
                event: 'jti.revoked',
                jti,
            })
        } catch (err) {
            logger.error({
                event: 'jti.revoke_failed',
                jti,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    },

    revokeByUserId: async (userId: string) => {
        try {
            const keys = await redisClient.keys(`${JTI_PREFIX}*`)
            for (const key of keys) {
                const val = await redisClient.get(key)
                if (val === userId) {
                    await redisClient.del(key)
                }
            }
            logger.info({
                event: 'jti.revoke_by_user',
                userId,
            })
        } catch (err) {
            logger.error({
                event: 'jti.revoke_by_user_failed',
                userId,
                error: err instanceof Error ? err.message : String(err),
            })
        }
    },
}
