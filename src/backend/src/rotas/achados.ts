import { Hono } from 'hono'
import { esquemaEditarAchado, paramId } from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import { detalharAchado, editarAchado } from '../servicos/achados.js'

export const rotasAchados = new Hono<Ambiente>()
  .get('/:id', validar('param', paramId), async (c) =>
    c.json(await detalharAchado(c.get('deps').db, c.req.valid('param').id, usuarioAtual(c)), 200),
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
