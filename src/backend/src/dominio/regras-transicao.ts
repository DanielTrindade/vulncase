import type { Papel, StatusAchado } from '@vulncase/compartilhado'

/**
 * Tabela 7 do documento 03 como estrutura de dados: fonte única das transições de
 * status. Qualquer par (origem, destino) ausente é inválido (HTTP 409); par presente
 * com papel não autorizado é acesso negado (HTTP 403).
 */
export interface RegraTransicao {
  origem: StatusAchado
  destino: StatusAchado
  /** Papéis autorizados. */
  papeis: readonly Papel[]
  /** RN04: o responsável pelo achado também pode executar, qualquer que seja o papel. */
  permiteResponsavel: boolean
  /** RF17: exige justificativa textual. */
  exigeJustificativa: boolean
  /** RN03: exige responsável definido. */
  exigeResponsavel: boolean
  /** Remove o responsável ao transicionar (EmCorrecao → Aberto). */
  removeResponsavel: boolean
  /** Nome da ação exibido na interface. */
  rotulo: string
}

const ANALISTA_ADMIN = ['Analista', 'Administrador'] as const
const ADMIN = ['Administrador'] as const

function regra(
  origem: StatusAchado,
  destino: StatusAchado,
  papeis: readonly Papel[],
  rotulo: string,
  opcoes: Partial<Omit<RegraTransicao, 'origem' | 'destino' | 'papeis' | 'rotulo'>> = {},
): RegraTransicao {
  return {
    origem,
    destino,
    papeis,
    rotulo,
    permiteResponsavel: false,
    exigeJustificativa: false,
    exigeResponsavel: false,
    removeResponsavel: false,
    ...opcoes,
  }
}

export const REGRAS_TRANSICAO: readonly RegraTransicao[] = [
  regra('Aberto', 'EmCorrecao', ANALISTA_ADMIN, 'Iniciar correção', { exigeResponsavel: true }),
  regra('Aberto', 'FalsoPositivo', ANALISTA_ADMIN, 'Marcar falso positivo', {
    exigeJustificativa: true,
  }),
  regra('Aberto', 'RiscoAceito', ADMIN, 'Aceitar risco', { exigeJustificativa: true }),
  regra('EmCorrecao', 'AguardandoVerificacao', ANALISTA_ADMIN, 'Concluir correção', {
    permiteResponsavel: true,
  }),
  regra('EmCorrecao', 'Aberto', ANALISTA_ADMIN, 'Devolver para Aberto', {
    removeResponsavel: true,
  }),
  regra('EmCorrecao', 'RiscoAceito', ADMIN, 'Aceitar risco', { exigeJustificativa: true }),
  regra('AguardandoVerificacao', 'Corrigido', ANALISTA_ADMIN, 'Aprovar verificação'),
  regra('AguardandoVerificacao', 'EmCorrecao', ANALISTA_ADMIN, 'Reprovar verificação', {
    exigeJustificativa: true,
    exigeResponsavel: true,
  }),
  regra('Corrigido', 'Aberto', ANALISTA_ADMIN, 'Reabrir', { exigeJustificativa: true }),
  regra('FalsoPositivo', 'Aberto', ANALISTA_ADMIN, 'Reabrir', { exigeJustificativa: true }),
  regra('RiscoAceito', 'Aberto', ANALISTA_ADMIN, 'Reabrir', { exigeJustificativa: true }),
]

export function buscarRegra(
  origem: StatusAchado,
  destino: StatusAchado,
): RegraTransicao | undefined {
  return REGRAS_TRANSICAO.find((r) => r.origem === origem && r.destino === destino)
}
