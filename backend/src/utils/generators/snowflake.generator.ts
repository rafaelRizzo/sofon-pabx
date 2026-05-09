import 'dotenv/config'
import { Snowflake } from '@sapphire/snowflake'

const epochEnv = process.env.SNOWFLAKE_EPOCH

if (!epochEnv) throw new Error('SNOWFLAKE_EPOCH not defined in .env')

export const generateSnowflake = new Snowflake(new Date(epochEnv))