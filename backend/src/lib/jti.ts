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
            // Redis indisponível != token revogado - propaga pra quem chama decidir (503, não 401),
            // senão um blip de Redis desloga todo mundo simultaneamente
            throw err
        }
    },

    // GETDEL: lê e apaga numa única operação atômica no Redis - elimina a janela de corrida entre
    // exists() e revoke() que permitia duas requests concorrentes (ex: 2 abas refrescando ao mesmo
    // tempo com o mesmo refresh token) passarem no check antes de qualquer uma revogar
    consume: async (jti: string): Promise<string | null> => {
        try {
            const userId = await redisClient.getDel(`${JTI_PREFIX}${jti}`)
            logger.info({
                event: userId ? 'jti.consumed' : 'jti.consume_miss',
                jti,
                userId: userId ?? undefined,
            })
            return userId
        } catch (err) {
            logger.error({
                event: 'jti.consume_failed',
                jti,
                error: err instanceof Error ? err.message : String(err),
            })
            throw err
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
            // SCAN (não-bloqueante) em vez de KEYS - KEYS trava o Redis em O(N) sob escala
            for await (const keys of redisClient.scanIterator({ MATCH: `${JTI_PREFIX}*`, COUNT: 100 })) {
                for (const key of keys) {
                    const val = await redisClient.get(key)
                    if (val === userId) {
                        await redisClient.del(key)
                    }
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
