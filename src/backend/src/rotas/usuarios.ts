import { Hono } from 'hono'
import { esquemaAlterarUsuario, esquemaCriarUsuario, paramId } from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador, somenteAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import {
  alterarUsuario,
  criarUsuario,
  listarResponsaveis,
  listarUsuarios,
} from '../servicos/usuarios.js'

export const rotasUsuarios = new Hono<Ambiente>()
  .get('/responsaveis', analistaOuAdministrador(), async (c) =>
    c.json({ itens: await listarResponsaveis(c.get('deps').db) }, 200),
  )
  .get('/', somenteAdministrador(), async (c) =>
    c.json({ itens: await listarUsuarios(c.get('deps').db) }, 200),
  )
  .post('/', somenteAdministrador(), validar('json', esquemaCriarUsuario), async (c) => {
    const criado = await criarUsuario(
      c.get('deps').db,
      c.get('log'),
      usuarioAtual(c),
      c.req.valid('json'),
    )
    c.header('Location', `/api/usuarios/${criado.id}`)
    return c.json(criado, 201)
  })
  .patch(
    '/:id',
    somenteAdministrador(),
    validar('param', paramId),
    validar('json', esquemaAlterarUsuario),
    async (c) => {
      const alterado = await alterarUsuario(
        c.get('deps').db,
        c.get('log'),
        usuarioAtual(c),
        c.req.valid('param').id,
        c.req.valid('json'),
      )
      return c.json(alterado, 200)
    },
  )
