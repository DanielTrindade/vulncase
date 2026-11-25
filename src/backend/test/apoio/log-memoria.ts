import { Writable } from 'node:stream'
import pino from 'pino'
import type { Log } from '../../src/infra/log.js'

/** Logger pino que grava as linhas em memória, para inspeção nos testes. */
export function criarLogMemoria(): { log: Log; linhas: () => Record<string, unknown>[] } {
  const buffer: string[] = []
  const destino = new Writable({
    write(chunk, _enc, cb) {
      buffer.push(String(chunk))
      cb()
    },
  })
  const log = pino({ level: 'debug' }, destino)
  return {
    log,
    linhas: () =>
      buffer
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
  }
}
