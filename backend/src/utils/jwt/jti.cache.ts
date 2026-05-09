import { redisClient } from '../cache/redis.client'
import { logger } from '../logger'

const JTI_PREFIX = 'jti:'
const REFRESH_JTI_PREFIX = 'refresh_jti:'

export const jtiManager = {
    add: async (jti: string, userId: string) => {
        try {
            await redisClient.setEx(`${JTI_PREFIX}${jti}`, 15 * 60, userId)
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
            return (await redisClient.get(`${JTI_PREFIX}${jti}`)) !== null
        } catch (err: any) {
            logger.error({
                event: 'redis.check_jti_failed',
                error: err.message,
                jti
            })
            return false
        }
    },

    addRefresh: async (jti: string, userId: string) => {
        try {
            await redisClient.setEx(`${REFRESH_JTI_PREFIX}${jti}`, 7 * 24 * 60 * 60, userId)
        } catch (err: any) {
            logger.error({
                event: 'redis.add_refresh_jti_failed',
                error: err.message,
                jti,
                userId
            })
            throw err
        }
    },

    existsRefresh: async (jti: string): Promise<boolean> => {
        try {
            return (await redisClient.get(`${REFRESH_JTI_PREFIX}${jti}`)) !== null
        } catch (err: any) {
            logger.error({
                event: 'redis.check_refresh_jti_failed',
                error: err.message,
                jti
            })
            return false
        }
    },

    revokeRefresh: async (jti: string) => {
        try {
            await redisClient.del(`${REFRESH_JTI_PREFIX}${jti}`)
        } catch (err: any) {
            logger.error({
                event: 'redis.revoke_refresh_jti_failed',
                error: err.message,
                jti
            })
        }
    },

    revoke: async (jti: string) => {
        try {
            await redisClient.del(`${JTI_PREFIX}${jti}`)
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
            const jtiKeys = await redisClient.keys(`${JTI_PREFIX}*`)
            const refreshKeys = await redisClient.keys(`${REFRESH_JTI_PREFIX}*`)
            const allKeys = [...jtiKeys, ...refreshKeys]

            if (allKeys.length > 0) {
                for (const key of allKeys) {
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