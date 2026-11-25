import { Hono } from 'hono'
import { esquemaFiltroProjetos, esquemaProjeto, paramId } from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
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
