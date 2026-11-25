import { serve } from '@hono/node-server'
import { app } from './app.js'
import { criarBanco } from './db/cliente.js'
import { aplicarMigrations } from './db/migrar.js'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL não definida')

const { db } = criarBanco(url)
await aplicarMigrations(db)

const porta = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: porta }, (info) => {
  console.log(`API ouvindo na porta ${info.port}`)
})
