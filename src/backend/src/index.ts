import { serve } from '@hono/node-server'
import { criarApp } from './app.js'
import { carregarConfig, ConfiguracaoInvalidaError } from './config.js'
import { criarBanco } from './db/cliente.js'
import { aplicarMigrations } from './db/migrar.js'
import { criarAdministradorInicial } from './db/admin-inicial.js'
import { criarLog } from './infra/log.js'

async function iniciar(): Promise<void> {
  let config
  try {
    config = carregarConfig()
  } catch (err) {
    if (err instanceof ConfiguracaoInvalidaError) {
      // Não usa o log ainda: o nível depende da própria configuração.
      console.error(JSON.stringify({ level: 'fatal', msg: err.message, campos: err.campos }))
      process.exit(1)
    }
    throw err
  }

  const log = criarLog(config.nivelLog)
  const { db, pool } = criarBanco(config.databaseUrl)

  await aplicarMigrations(db)
  log.info('migrations aplicadas')
  await criarAdministradorInicial(db, config, log)

  const app = criarApp({ db, config, log })
  const servidor = serve({ fetch: app.fetch, port: config.porta }, (info) => {
    log.info({ porta: info.port, ambiente: config.ambiente }, 'API iniciada')
  })

  const encerrar = (sinal: string) => {
    log.info({ sinal }, 'encerrando')
    servidor.close(() => {
      void pool.end().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', () => encerrar('SIGTERM'))
  process.on('SIGINT', () => encerrar('SIGINT'))
}

await iniciar()
