import cron from 'node-cron'
import { cleanExpiredRefreshTokens } from '../utils/jwt/handler.jwt'

export const startCleanupJob = () => {
    cron.schedule('0 * * * *', async () => {
        try {
            await cleanExpiredRefreshTokens()
            console.log('✓ Tokens expirados limpos')
        } catch (error) {
            console.error('Erro ao limpar tokens:', error)
        }
    })
}
