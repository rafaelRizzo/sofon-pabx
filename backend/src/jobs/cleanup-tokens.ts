import cron from 'node-cron'
import { cleanExpiredRefreshTokens } from '../utils/jwt/handler.jwt'
import { logger } from '../utils/logger'

export const startCleanupJob = () => {
    cron.schedule('0 * * * *', async () => {
        try {
            await cleanExpiredRefreshTokens()
            logger.info({ event: 'cleanup.tokens.completed' })
        } catch (error) {
            logger.error({ event: 'cleanup.tokens.failed', error: (error as Error).message })
        }
    })
}
