import { Hono } from 'hono'
import type { Ambiente, Dependencias } from './ambiente.js'
import { naoEncontrado, tratarErro } from './middlewares/erros.js'
import { registrarRequisicao } from './middlewares/requisicao.js'

export function criarApp(deps: Dependencias) {
  const app = new Hono<Ambiente>()
    .use(registrarRequisicao(deps))
    .get('/api/health', (c) => c.json({ status: 'ok' as const }))

  app.onError(tratarErro)
  app.notFound(naoEncontrado)
  return app
}

export type AppType = ReturnType<typeof criarApp>
