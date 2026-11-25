import { Hono } from 'hono'
import {
  esquemaCriarAchado,
  esquemaFiltroProjetos,
  esquemaProjeto,
  paramId,
} from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import { registrarAchado } from '../servicos/achados.js'
import { painelProjeto } from '../servicos/painel.js'
import { gerarRelatorioCsv } from '../servicos/relatorio-csv.js'
import {
  arquivarProjeto,
  criarProjeto,
  editarProjeto,
  listarProjetos,
  obterProjeto,
} from '../servicos/projetos.js'

export const rotasProjetos = new Hono<Ambiente>()
  .get('/', validar('query', esquemaFiltroProjetos), async (c) => {
    const { arquivados } = c.req.valid('query')
    return c.json({ itens: await listarProjetos(c.get('deps').db, arquivados) }, 200)
  })
  .post('/', analistaOuAdministrador(), validar('json', esquemaProjeto), async (c) => {
    const projeto = await criarProjeto(
      c.get('deps').db,
      c.get('log'),
      usuarioAtual(c),
      c.req.valid('json'),
    )
    c.header('Location', `/api/projetos/${projeto.id}`)
    return c.json(projeto, 201)
  })
  .get('/:id', validar('param', paramId), async (c) =>
    c.json(await obterProjeto(c.get('deps').db, c.req.valid('param').id), 200),
  )
  .get('/:id/relatorio.csv', validar('param', paramId), async (c) => {
    const { csv, nomeArquivo, total } = await gerarRelatorioCsv(
      c.get('deps').db,
      c.req.valid('param').id,
    )
    c.get('log').info({
      evento: 'relatorio.csv',
      usuarioId: usuarioAtual(c).id,
      projetoId: c.req.valid('param').id,
      total,
    })
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Cache-Control': 'no-store',
    })
  })
  .get('/:id/painel', validar('param', paramId), async (c) =>
    c.json(await painelProjeto(c.get('deps').db, c.req.valid('param').id), 200),
  )
  .put(
    '/:id',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaProjeto),
    async (c) =>
      c.json(
        await editarProjeto(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  .post('/:id/arquivar', analistaOuAdministrador(), validar('param', paramId), async (c) =>
    c.json(
      await arquivarProjeto(
        c.get('deps').db,
        c.get('log'),
        usuarioAtual(c),
        c.req.valid('param').id,
      ),
      200,
    ),
  )
  .post(
    '/:id/achados',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaCriarAchado),
    async (c) => {
      const achado = await registrarAchado(
        c.get('deps').db,
        c.get('log'),
        usuarioAtual(c),
        c.req.valid('param').id,
        c.req.valid('json'),
        c.get('deps').config.prazos,
      )
      c.header('Location', `/api/achados/${achado.id}`)
      return c.json(achado, 201)
    },
  )
