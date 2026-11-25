import { criarBanco } from './cliente.js'
import { aplicarMigrations } from './migrar.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL não definida')
  process.exit(1)
}
const { db, pool } = criarBanco(url)
await aplicarMigrations(db)
await pool.end()
console.log('Migrations aplicadas.')
