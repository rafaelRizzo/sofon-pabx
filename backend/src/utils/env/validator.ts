const REQUIRED_VARS = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SNOWFLAKE_EPOCH',
    'COOKIE_SECRET',
]

export const validateEnv = () => {
    const missing: string[] = []
    const empty: string[] = []

    REQUIRED_VARS.forEach(key => {
        if (!(key in process.env)) {
            missing.push(key)
        } else if (!process.env[key]?.trim()) {
            empty.push(key)
        }
    })

    if (missing.length > 0 || empty.length > 0) {
        console.error('❌ Environment validation failed:')
        if (missing.length > 0) console.error(`  Missing: ${missing.join(', ')}`)
        if (empty.length > 0) console.error(`  Empty: ${empty.join(', ')}`)
        process.exit(1)
    }

    console.log(`✓ Environment validated`)
}
