/**
 * Erros de domínio e de aplicação. Cada erro conhece o código HTTP e o título usados
 * na resposta Problem Details; o tratador global não expõe nenhum outro detalhe.
 */
export abstract class ErroAplicacao extends Error {
  abstract readonly status: number
  abstract readonly titulo: string

  constructor(mensagem: string) {
    super(mensagem)
    this.name = new.target.name
  }
}

export interface ErroCampo {
  campo: string
  mensagem: string
}

export class ValidacaoError extends ErroAplicacao {
  readonly status = 400
  readonly titulo = 'Dados inválidos'
  constructor(
    public readonly erros: ErroCampo[],
    mensagem = 'Um ou mais campos são inválidos.',
  ) {
    super(mensagem)
  }
}

export class NaoAutenticadoError extends ErroAplicacao {
  readonly status = 401
  readonly titulo = 'Não autenticado'
  constructor(mensagem = 'Sessão ausente, expirada ou revogada.') {
    super(mensagem)
  }
}

export class AcessoNegadoError extends ErroAplicacao {
  readonly status = 403
  readonly titulo = 'Acesso negado'
  constructor(mensagem = 'Você não tem permissão para executar esta ação.') {
    super(mensagem)
  }
}

export class RecursoNaoEncontradoError extends ErroAplicacao {
  readonly status = 404
  readonly titulo = 'Recurso não encontrado'
  constructor(mensagem = 'O recurso solicitado não existe.') {
    super(mensagem)
  }
}

export class ConflitoError extends ErroAplicacao {
  readonly status = 409
  readonly titulo = 'Conflito'
}

export class TransicaoInvalidaError extends ErroAplicacao {
  readonly status = 409
  readonly titulo = 'Transição inválida'
}

export class VersaoDivergenteError extends ErroAplicacao {
  readonly status = 409
  readonly titulo = 'Conflito de versão'
  constructor(
    mensagem = 'O registro foi alterado por outro usuário. Recarregue e tente novamente.',
  ) {
    super(mensagem)
  }
}

export class ContaBloqueadaError extends ErroAplicacao {
  readonly status = 429
  readonly titulo = 'Conta bloqueada'
  constructor(
    mensagem = 'Conta bloqueada temporariamente por excesso de tentativas. Tente novamente mais tarde.',
  ) {
    super(mensagem)
  }
}
