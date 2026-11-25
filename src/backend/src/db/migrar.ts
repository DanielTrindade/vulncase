import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { BancoDados } from './cliente.js'

/**
 * Pasta das migrations. Em desenvolvimento fica em src/backend/drizzle; no contêiner,
 * ao lado de dist/. Pode ser sobrescrita por MIGRATIONS_DIRETORIO.
 */
function pastaMigrations(): string {
  if (process.env.MIGRATIONS_DIRETORIO) return process.env.MIGRATIONS_DIRETORIO
  const aqui = path.dirname(fileURLToPath(import.meta.url))
  // src/db -> ../../drizzle ; dist -> ../drizzle
  return aqui.endsWith(path.join('src', 'db'))
    ? path.resolve(aqui, '../../drizzle')
    : path.resolve(aqui, '../drizzle')
}

export async function aplicarMigrations(db: BancoDados): Promise<void> {
  await migrate(db, { migrationsFolder: pastaMigrations() })
}
