import { Hono } from 'hono'
import type { Ambiente, Dependencias } from './ambiente.js'
import { naoEncontrado, tratarErro } from './middlewares/erros.js'
import { registrarRequisicao } from './middlewares/requisicao.js'
import { cabecalhosSeguranca, limitarCorpo, verificarOrigem } from './middlewares/seguranca.js'
import { carregarSessao, exigirSessao } from './middlewares/sessao.js'
import { rotasAuth } from './rotas/auth.js'
import { rotasProjetos } from './rotas/projetos.js'
import { rotasUsuarios } from './rotas/usuarios.js'

/**
 * Composição da aplicação (docs/04-arquitetura.md, Listagem 1). A ordem garante que
 * cabeçalhos, verificação de origem e limite de corpo sejam aplicados antes de
 * qualquer leitura de sessão ou de corpo.
 */
export function criarApp(deps: Dependencias) {
  const app = new Hono<Ambiente>()
    .use(registrarRequisicao(deps))
    .use(cabecalhosSeguranca())
    .use('/api/*', verificarOrigem(deps.config.origemPermitida))
    .use('/api/*', limitarCorpo())
    .use('/api/*', carregarSessao())
    .use('/api/*', exigirSessao())
    .get('/api/health', (c) => c.json({ status: 'ok' as const }))
    .route('/api/auth', rotasAuth)
    .route('/api/usuarios', rotasUsuarios)
    .route('/api/projetos', rotasProjetos)

  app.onError(tratarErro)
  app.notFound(naoEncontrado)
  return app
}

export type AppType = ReturnType<typeof criarApp>
