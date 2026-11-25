import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

export type BancoDados = NodePgDatabase<typeof schema>

export function criarBanco(url: string): { db: BancoDados; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max: 10 })
  const db = drizzle(pool, { schema })
  return { db, pool }
}
