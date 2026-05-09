import { db } from '../../db/config/db'
import { redisClient } from '../cache/redis.client'
import { users } from '../../db/schemas/users'

export interface HealthStatus {
    status: 'ok' | 'degraded' | 'down'
    timestamp: string
    uptime: number
    services: {
        redis: 'ok' | 'down'
        database: 'ok' | 'down'
    }
}

export const getHealthStatus = async (): Promise<HealthStatus> => {
    const health: HealthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            redis: 'down',
            database: 'down'
        }
    }

    try {
        await redisClient.ping()
        health.services.redis = 'ok'
    } catch (error) {
        health.status = 'degraded'
    }

    try {
        await db.select({ id: users.id }).from(users).limit(1)
        health.services.database = 'ok'
    } catch (error) {
        health.status = 'degraded'
    }

    if (health.services.redis === 'down' || health.services.database === 'down') {
        health.status = health.services.redis === 'down' && health.services.database === 'down' ? 'down' : 'degraded'
    }

    return health
}
