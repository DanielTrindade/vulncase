import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestProject } from 'vitest/node'
import { criarBanco } from '../../src/db/cliente.js'
import { aplicarMigrations } from '../../src/db/migrar.js'

let container: StartedPostgreSqlContainer | undefined

/**
 * Sobe um PostgreSQL 17 com Testcontainers, aplica as migrations em um banco modelo
 * e publica a URL. Cada arquivo de teste cria seu próprio banco a partir do modelo.
 * Se TEST_DATABASE_URL estiver definida, usa esse servidor em vez do contêiner.
 */
export default async function setup(project: TestProject) {
  let urlAdmin = process.env.TEST_DATABASE_URL
  if (!urlAdmin) {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('postgres')
      .withUsername('vulncase')
      .withPassword('vulncase')
      .start()
    urlAdmin = container.getConnectionUri()
  }

  const { pool: poolAdmin } = criarBanco(urlAdmin)
  await poolAdmin.query('DROP DATABASE IF EXISTS vulncase_modelo')
  await poolAdmin.query('CREATE DATABASE vulncase_modelo')

  const urlModelo = trocarBanco(urlAdmin, 'vulncase_modelo')
  const { db, pool } = criarBanco(urlModelo)
  await aplicarMigrations(db)
  await pool.end()
  await poolAdmin.end()

  project.provide('urlAdminBanco', urlAdmin)

  return async () => {
    await container?.stop()
  }
}

export function trocarBanco(url: string, banco: string): string {
  const u = new URL(url)
  u.pathname = `/${banco}`
  return u.toString()
}

declare module 'vitest' {
  export interface ProvidedContext {
    urlAdminBanco: string
  }
}
