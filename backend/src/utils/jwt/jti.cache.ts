import { redisClient } from '../redis'
import { logger } from '../logger'

export const jtiManager = {
    add: async (jti: string, userId: string) => {
        try {
            await redisClient.setEx(jti, 24 * 60 * 60, userId)
        } catch (err: any) {
            logger.error({
                event: 'redis.add_jti_failed',
                error: err.message,
                jti,
                userId
            })
            throw err
        }
    },

    exists: async (jti: string): Promise<boolean> => {
        try {
            return (await redisClient.get(jti)) !== null
        } catch (err: any) {
            logger.error({
                event: 'redis.check_jti_failed',
                error: err.message,
                jti
            })
            return false
        }
    },

    revoke: async (jti: string) => {
        try {
            await redisClient.del(jti)
        } catch (err: any) {
            logger.error({
                event: 'redis.revoke_jti_failed',
                error: err.message,
                jti
            })
        }
    },

    revokeByUserId: async (userId: string) => {
        try {
            const keys = await redisClient.keys(`*`)
            if (keys.length > 0) {
                for (const key of keys) {
                    const val = await redisClient.get(key)
                    if (val === userId) {
                        await redisClient.del(key)
                    }
                }
            }
        } catch (err: any) {
            logger.error({
                event: 'redis.revoke_by_user_failed',
                error: err.message,
                userId
            })
        }
    }
}