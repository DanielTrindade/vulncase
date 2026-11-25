import pino, { type Logger } from 'pino'

export type Log = Logger

/**
 * Log estruturado (RNF13). Nunca registra corpo de requisição, senha, cookie ou token:
 * os caminhos abaixo são removidos mesmo que algum chamador os inclua por engano.
 */
export function criarLog(nivel: string): Log {
  return pino({
    level: nivel,
    base: { servico: 'vulncase-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'senha',
        '*.senha',
        'senhaAtual',
        '*.senhaAtual',
        'novaSenha',
        '*.novaSenha',
        'password',
        '*.password',
        'passwordHash',
        '*.passwordHash',
        'token',
        '*.token',
        'cookie',
        '*.cookie',
        'headers.cookie',
        'body',
        '*.body',
      ],
      censor: '[removido]',
    },
  })
}
