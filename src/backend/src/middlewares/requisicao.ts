import { randomUUID } from 'node:crypto'
import { createMiddleware } from 'hono/factory'
import type { Ambiente, Dependencias } from '../ambiente.js'

/**
 * Primeiro middleware da cadeia: disponibiliza as dependências, gera o identificador da
 * requisição e registra método, rota, status e duração. Não registra corpo, cabeçalhos
 * nem parâmetros de consulta.
 */
export function registrarRequisicao(deps: Dependencias) {
  return createMiddleware<Ambiente>(async (c, next) => {
    const requestId = randomUUID()
    const log = deps.log.child({ requestId })
    c.set('deps', deps)
    c.set('requestId', requestId)
    c.set('log', log)
    c.set('usuario', null)
    c.set('sessaoId', null)
    c.header('X-Request-Id', requestId)

    const inicio = performance.now()
    await next()
    const duracaoMs = Math.round(performance.now() - inicio)
    const usuario = c.get('usuario')
    log.info(
      {
        metodo: c.req.method,
        rota: c.req.path,
        status: c.res.status,
        duracaoMs,
        usuarioId: usuario?.id ?? null,
      },
      'requisição',
    )
  })
}
