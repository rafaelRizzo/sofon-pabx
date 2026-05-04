import { sql } from 'drizzle-orm'
import { createInterface } from 'readline'
import { db } from '../config/db'

function prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans) }))
}

async function resetDB() {
    const first = await prompt('⚠️  Isso vai apagar TODAS as tabelas. Confirma? (yes/no): ')
    if (first.trim() !== 'yes') return console.log('Cancelado.')

    const second = await prompt('⚠️  Tem certeza? Essa ação é irreversível. (yes/no): ')
    if (second.trim() !== 'yes') return console.log('Cancelado.')

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
    console.log('All tables dropped')
    process.exit(0)
}

resetDB()