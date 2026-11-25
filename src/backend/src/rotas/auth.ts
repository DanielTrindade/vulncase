import { Hono } from 'hono'
import { esquemaLogin, esquemaTrocarSenha } from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { apagarCookieSessao, gravarCookieSessao, usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import { entrar, sair } from '../servicos/autenticacao.js'
import { trocarSenha } from '../servicos/usuarios.js'

function ipCliente(cabecalho: string | undefined): string | null {
  // O Caddy acrescenta o IP do cliente em X-Forwarded-For.
  return cabecalho?.split(',')[0]?.trim() || null
}

export const rotasAuth = new Hono<Ambiente>()
  .post('/login', validar('json', esquemaLogin), async (c) => {
    const { db } = c.get('deps')
    const resultado = await entrar(c.req.valid('json'), {
      db,
      log: c.get('log'),
      ip: ipCliente(c.req.header('x-forwarded-for')),
      userAgent: c.req.header('user-agent') ?? null,
    })
    gravarCookieSessao(c, resultado.token, resultado.expiraEm)
    return c.json({ usuario: resultado.usuario }, 200)
  })
  .post('/logout', async (c) => {
    const sessaoId = c.get('sessaoId')
    if (sessaoId) await sair(c.get('deps').db, sessaoId)
    apagarCookieSessao(c)
    c.get('log').info({ evento: 'auth.logout', usuarioId: c.get('usuario')?.id })
    return c.body(null, 204)
  })
  .get('/me', (c) => c.json({ usuario: usuarioAtual(c) }, 200))
  .put('/senha', validar('json', esquemaTrocarSenha), async (c) => {
    await trocarSenha(
      c.get('deps').db,
      c.get('log'),
      usuarioAtual(c),
      c.get('sessaoId'),
      c.req.valid('json'),
    )
    return c.body(null, 204)
  })
