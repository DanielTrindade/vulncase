import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { inject } from 'vitest'
import { criarBanco } from '../../src/db/cliente.js'
import { trocarBanco } from './global-setup.js'

/**
 * Cria um banco isolado, copiado do modelo já migrado. Use em beforeAll de cada
 * arquivo de teste de integração.
 */
export async function criarBancoIsolado() {
  const urlAdmin = inject('urlAdminBanco')
  const nome = `teste_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Client({ connectionString: urlAdmin })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${nome} TEMPLATE vulncase_modelo`)
  await admin.end()

  const url = trocarBanco(urlAdmin, nome)
  const { db, pool } = criarBanco(url)
  return {
    db,
    pool,
    url,
    async encerrar() {
      await pool.end()
    },
  }
}
