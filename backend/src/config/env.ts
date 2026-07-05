import { z } from 'zod'

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3333),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().default('your-secret-key-change-in-production'),
    REFRESH_SECRET: z.string().default('your-refresh-secret-change-in-production'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGIN: z.string().default('http://localhost:3333'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    LOG_ENABLED: z.coerce.boolean().default(true),
    API_BASE_URL: z.string().default('http://localhost:3333'),
    API_TIMEOUT: z.coerce.number().default(10000),
    RATE_LIMIT_MAX: z.coerce.number().default(1000),
    RATE_LIMIT_WINDOW: z.string().default('1 second'),
    DATABASE_POOL_SIZE: z.coerce.number().default(10),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    TZ: z.string().default('America/Sao_Paulo'),
    // FastAGI server (src/asterisk/agi-server.ts) — host/porta que o Asterisk usa pra conectar via
    // AGI(agi://AGI_HOST:AGI_PORT/run,<requestTemplateId>) ao executar um RouteDestination type: "request"
    AGI_HOST: z.string().default('127.0.0.1'),
    AGI_PORT: z.coerce.number().default(4573),
})

export type Env = z.infer<typeof envSchema>

export const validateEnv = (): Env => {
    try {
        return envSchema.parse(process.env)
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missing = error.issues.map((e) => e.path.join('.')).join(', ')
            throw new Error(`Missing or invalid environment variables: ${missing}`)
        }
        throw error
    }
}
