import 'dotenv/config'
import { logger } from '../logger'

const REQUIRED_ENV_KEYS = [
    'DATABASE_URL',
    'NODE_ENV',
    'PORT',
    'ALLOWED_IPS',
    'CORS_ORIGIN',
    'JWT_SECRET',
    // 'ASTERISK_HOST',
    // 'ASTERISK_PORT',
    // 'ASTERISK_USER',
    // 'ASTERISK_PASS'
]

export const checkEnvsInit = () => {
    logger.info('Checking environment variables...')
    for (const key of REQUIRED_ENV_KEYS) {
        if (!process.env[key]) {
            throw new Error(`Missing environment variable: ${key}.`)
        } else {
            logger.info(`Environment variable ${key} found.`)
        }
    }
}
