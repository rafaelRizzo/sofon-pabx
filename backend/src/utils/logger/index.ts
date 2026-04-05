import pino from 'pino'

export const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
        process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true }
            }
            : undefined
})