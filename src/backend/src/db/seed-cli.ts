import { carregarConfig, ConfiguracaoInvalidaError } from '../config.js'
import { criarLog } from '../infra/log.js'
import { criarBanco } from './cliente.js'
import { aplicarMigrations } from './migrar.js'
import { carregarDemonstracao, SENHA_DEMONSTRACAO_PADRAO } from './seed.js'

/** pnpm db:seed — disponível apenas com NODE_ENV=development (RNF19). */
async function principal() {
  let config
  try {
    config = carregarConfig()
  } catch (err) {
    if (err instanceof ConfiguracaoInvalidaError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }
  if (config.ambiente !== 'development') {
    console.error('A carga de demonstração só é permitida com NODE_ENV=development.')
    process.exit(1)
  }
  const log = criarLog('info')
  const { db, pool } = criarBanco(config.databaseUrl)
  try {
    await aplicarMigrations(db)
    const senha = process.env.DEMO_SENHA || SENHA_DEMONSTRACAO_PADRAO
    const r = await carregarDemonstracao(db, log, senha)
    if (r === 'carregado') {
      console.log(
        '\nUsuários de demonstração (senha: DEMO_SENHA ou o padrão documentado no README):',
      )
      console.log('  admin@demo.vulncase.local     Administrador')
      console.log('  analista@demo.vulncase.local  Analista')
      console.log('  dev@demo.vulncase.local       Desenvolvedor')
    }
  } finally {
    await pool.end()
  }
}

await principal()
