import { and, eq, gt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { Ambiente, UsuarioSessao } from '../ambiente.js'
import { sessoes, usuarios } from '../db/schema.js'
import { NaoAutenticadoError } from '../dominio/erros.js'
import { hashToken } from '../infra/token.js'

/** Prefixo __Host-: exige Secure, Path=/ e proíbe Domain. */
export const NOME_COOKIE_SESSAO = '__Host-vulncase_sessao'
export const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000

export function gravarCookieSessao(c: Context<Ambiente>, token: string, expiraEm: Date): void {
  setCookie(c, NOME_COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    expires: expiraEm,
    maxAge: Math.floor(DURACAO_SESSAO_MS / 1000),
  })
}

export function apagarCookieSessao(c: Context<Ambiente>): void {
  deleteCookie(c, NOME_COOKIE_SESSAO, { path: '/', secure: true })
}

/**
 * Identifica o usuário pela sessão: calcula o hash do cookie e busca uma sessão não
 * expirada de um usuário ativo. Não recusa a requisição; quem recusa é exigirSessao.
 */
export function carregarSessao() {
  return createMiddleware<Ambiente>(async (c, next) => {
    const token = getCookie(c, NOME_COOKIE_SESSAO)
    if (token && token.length <= 128) {
      const { db } = c.get('deps')
      const [linha] = await db
        .select({
          sessaoId: sessoes.id,
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          papel: usuarios.papel,
        })
        .from(sessoes)
        .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
        .where(
          and(
            eq(sessoes.tokenHash, hashToken(token)),
            gt(sessoes.expiraEm, new Date()),
            eq(usuarios.ativo, true),
          ),
        )
        .limit(1)
      if (linha) {
        const { sessaoId, ...usuario } = linha
        c.set('usuario', usuario)
        c.set('sessaoId', sessaoId)
      }
    }
    await next()
  })
}

/** Rotas acessíveis sem sessão. Todas as demais sob /api exigem sessão válida. */
const ROTAS_PUBLICAS = new Set(['GET /api/health', 'POST /api/auth/login'])

export function exigirSessao() {
  return createMiddleware<Ambiente>(async (c, next) => {
    if (!ROTAS_PUBLICAS.has(`${c.req.method} ${c.req.path}`) && !c.get('usuario')) {
      throw new NaoAutenticadoError()
    }
    await next()
  })
}

/** Usuário autenticado da requisição; lança 401 se ausente. */
export function usuarioAtual(c: Context<Ambiente>): UsuarioSessao {
  const usuario = c.get('usuario')
  if (!usuario) throw new NaoAutenticadoError()
  return usuario
}
