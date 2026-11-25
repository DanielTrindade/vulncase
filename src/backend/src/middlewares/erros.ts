import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Ambiente } from '../ambiente.js'
import { ErroAplicacao, ValidacaoError, type ErroCampo } from '../dominio/erros.js'

/** Corpo Problem Details (RFC 9457). */
export interface Problema {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  requestId?: string
  errors?: ErroCampo[]
}

const TITULOS_HTTP: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Recurso não encontrado',
  405: 'Método não permitido',
  409: 'Conflito',
  413: 'Corpo da requisição muito grande',
  415: 'Tipo de conteúdo não suportado',
  429: 'Muitas requisições',
}

export function responderProblema(
  c: Context<Ambiente>,
  status: number,
  titulo: string,
  detalhe?: string,
  erros?: ErroCampo[],
): Response {
  const corpo: Problema = {
    type: 'about:blank',
    title: titulo,
    status,
    instance: c.req.path,
    requestId: c.get('requestId'),
  }
  if (detalhe) corpo.detail = detalhe
  if (erros) corpo.errors = erros
  return c.json(corpo, status as ContentfulStatusCode, {
    'Content-Type': 'application/problem+json',
  })
}

/**
 * Tratador global (RNF11): erros conhecidos viram Problem Details com mensagem pública;
 * qualquer outro erro vira 500 genérico e é registrado no log com o identificador da
 * requisição. Pilha de execução, SQL e caminhos internos nunca chegam ao cliente.
 */
export const tratarErro: ErrorHandler<Ambiente> = (err, c) => {
  const log = c.get('log')

  if (err instanceof ValidacaoError) {
    return responderProblema(c, err.status, err.titulo, err.message, err.erros)
  }
  if (err instanceof ErroAplicacao) {
    return responderProblema(c, err.status, err.titulo, err.message)
  }
  if (err instanceof HTTPException) {
    const status = err.status
    if (status === 403) {
      // O único HTTPException 403 vem da verificação de origem (CSRF).
      log?.warn({ evento: 'csrf.origem_recusada', origem: c.req.header('origin') ?? null })
      return responderProblema(
        c,
        403,
        'Origem não permitida',
        'A origem da requisição não é aceita.',
      )
    }
    if (status >= 500) {
      log?.error({ err }, 'erro HTTP interno')
      return responderProblema(c, 500, 'Erro interno', 'Ocorreu um erro inesperado.')
    }
    return responderProblema(c, status, TITULOS_HTTP[status] ?? 'Erro na requisição')
  }

  log?.error({ err }, 'erro não tratado')
  return responderProblema(c, 500, 'Erro interno', 'Ocorreu um erro inesperado.')
}

export const naoEncontrado: NotFoundHandler<Ambiente> = (c) =>
  responderProblema(c, 404, 'Recurso não encontrado', 'A rota solicitada não existe.')
