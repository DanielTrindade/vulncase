import { Hono } from 'hono'
import {
  esquemaAtribuirResponsavel,
  esquemaEditarAchado,
  esquemaTransicao,
  paramId,
} from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import {
  alterarResponsavel,
  detalharAchado,
  editarAchado,
  executarTransicao,
} from '../servicos/achados.js'
import { listarHistorico } from '../servicos/historico.js'

export const rotasAchados = new Hono<Ambiente>()
  .get('/:id', validar('param', paramId), async (c) =>
    c.json(await detalharAchado(c.get('deps').db, c.req.valid('param').id, usuarioAtual(c)), 200),
  )
  .get('/:id/historico', validar('param', paramId), async (c) =>
    c.json({ itens: await listarHistorico(c.get('deps').db, c.req.valid('param').id) }, 200),
  )
  .put(
    '/:id',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaEditarAchado),
    async (c) =>
      c.json(
        await editarAchado(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  .put(
    '/:id/responsavel',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaAtribuirResponsavel),
    async (c) =>
      c.json(
        await alterarResponsavel(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  // Sem exigirPapel: a Tabela 7 decide por papel e por propriedade (RN04) no domínio.
  .post(
    '/:id/transicoes',
    validar('param', paramId),
    validar('json', esquemaTransicao),
    async (c) =>
      c.json(
        await executarTransicao(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
