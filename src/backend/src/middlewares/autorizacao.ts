import type { Papel } from '@vulncase/compartilhado'
import { createMiddleware } from 'hono/factory'
import type { Ambiente } from '../ambiente.js'
import { AcessoNegadoError } from '../dominio/erros.js'
import { usuarioAtual } from './sessao.js'

/**
 * Autorização por papel (RNF06). Cada rota declara os papéis aceitos; as regras de
 * propriedade do recurso (ex.: responsável pelo achado) ficam nas funções de domínio.
 */
export function exigirPapel(...papeis: [Papel, ...Papel[]]) {
  const aceitos = new Set<Papel>(papeis)
  return createMiddleware<Ambiente>(async (c, next) => {
    const usuario = usuarioAtual(c)
    if (!aceitos.has(usuario.papel)) {
      c.get('log').warn({
        evento: 'autorizacao.negada',
        usuarioId: usuario.id,
        papel: usuario.papel,
        metodo: c.req.method,
        rota: c.req.path,
      })
      throw new AcessoNegadoError()
    }
    await next()
  })
}

/** Atalhos para as combinações da matriz de permissões (docs/02, Tabela 1). */
export const somenteAdministrador = () => exigirPapel('Administrador')
export const analistaOuAdministrador = () => exigirPapel('Analista', 'Administrador')
