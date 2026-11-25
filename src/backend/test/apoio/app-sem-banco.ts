import { criarApp } from '../../src/app.js'
import { carregarConfig } from '../../src/config.js'
import type { BancoDados } from '../../src/db/cliente.js'
import { criarLogMemoria } from './log-memoria.js'

export const ORIGEM_TESTE = 'https://localhost'

/** App sem banco, para testar middlewares e tratamento de erros. */
export function criarAppSemBanco() {
  const { log, linhas } = criarLogMemoria()
  const config = carregarConfig({
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    ORIGEM_PERMITIDA: ORIGEM_TESTE,
  })
  const app = criarApp({ db: {} as BancoDados, config, log })
  return { app, linhas }
}
