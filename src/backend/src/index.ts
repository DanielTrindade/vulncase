import { serve } from '@hono/node-server'
import { app } from './app.js'

const porta = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port: porta }, (info) => {
  console.log(`API ouvindo na porta ${info.port}`)
})
