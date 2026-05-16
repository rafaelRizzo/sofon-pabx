import { sql } from 'drizzle-orm'
import { createInterface } from 'readline'
import { db } from '../config/db'
import { logger } from '../../utils/logger'

const prompt = (question: string): Promise<string> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

const resetDB = async () => {
    const first = await prompt('⚠️  This will DROP ALL tables. Confirm? (yes/no): ')
    if (first.trim() !== 'yes') {
        logger.info({ event: 'db.reset.cancelled' })
        return
    }

    const second = await prompt('⚠️  Are you sure? This action is irreversible. (yes/no): ')
    if (second.trim() !== 'yes') {
        logger.info({ event: 'db.reset.cancelled' })
        return
    }

    await db.execute(sql`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `)
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
    logger.info({ event: 'db.reset.completed' })
    process.exit(0)
}

resetDB()