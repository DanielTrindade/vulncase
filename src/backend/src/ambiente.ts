import type { Papel } from '@vulncase/compartilhado'
import type { Config } from './config.js'
import type { BancoDados } from './db/cliente.js'
import type { Armazenamento } from './infra/armazenamento.js'
import type { Log } from './infra/log.js'

export interface UsuarioSessao {
  id: string
  nome: string
  email: string
  papel: Papel
}

export interface Dependencias {
  db: BancoDados
  config: Config
  log: Log
  armazenamento: Armazenamento
}

/** Tipo do contexto Hono compartilhado por middlewares e rotas. */
export interface Ambiente {
  Variables: {
    deps: Dependencias
    log: Log
    requestId: string
    usuario: UsuarioSessao | null
    sessaoId: string | null
  }
}
