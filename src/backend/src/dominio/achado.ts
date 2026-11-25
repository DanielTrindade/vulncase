import {
  estaEncerrado,
  type Papel,
  type StatusAchado,
  type TipoEvento,
} from '@vulncase/compartilhado'
import {
  AcessoNegadoError,
  ConflitoError,
  TransicaoInvalidaError,
  ValidacaoError,
} from './erros.js'
import { buscarRegra, REGRAS_TRANSICAO, type RegraTransicao } from './regras-transicao.js'

export interface Ator {
  id: string
  papel: Papel
}

export interface Referencia {
  id: string
  nome: string
}

/** Estado mínimo do achado sobre o qual as regras operam. */
export interface EstadoAchado {
  status: StatusAchado
  responsavel: Referencia | null
  encerradoEm: Date | null
}

export interface EventoNovo {
  tipo: TipoEvento
  campo: string | null
  valorAnterior: string | null
  valorNovo: string | null
  justificativa: string | null
}

export interface Resultado<T> {
  achado: T
  eventos: EventoNovo[]
}

export const JUSTIFICATIVA_MAXIMO = 4000

const PAPEIS_GESTAO: readonly Papel[] = ['Analista', 'Administrador']

function ehGestor(ator: Ator): boolean {
  return PAPEIS_GESTAO.includes(ator.papel)
}

function ehResponsavel(achado: EstadoAchado, ator: Ator): boolean {
  return achado.responsavel?.id === ator.id
}

function normalizarJustificativa(justificativa: string | null | undefined): string | null {
  const texto = justificativa?.trim()
  return texto ? texto : null
}

function autorizado(regra: RegraTransicao, achado: EstadoAchado, ator: Ator): boolean {
  return (
    regra.papeis.includes(ator.papel) || (regra.permiteResponsavel && ehResponsavel(achado, ator))
  )
}

/**
 * Altera o status conforme a Tabela 7 (RF16, RF17, RN03 a RN06).
 *
 * @throws TransicaoInvalidaError (409) par origem/destino inexistente ou condição de estado não atendida
 * @throws AcessoNegadoError (403) papel ou propriedade não autorizados
 * @throws ValidacaoError (400) justificativa ausente quando exigida
 */
export function transicionar<T extends EstadoAchado>(
  achado: T,
  destino: StatusAchado,
  ator: Ator,
  justificativa: string | null | undefined,
  agora: Date,
): Resultado<T> {
  const regra = buscarRegra(achado.status, destino)
  if (!regra) {
    throw new TransicaoInvalidaError(`Não é possível passar de ${achado.status} para ${destino}.`)
  }
  if (!autorizado(regra, achado, ator)) {
    throw new AcessoNegadoError(
      regra.permiteResponsavel
        ? 'Somente o responsável pelo achado, um analista ou um administrador pode executar esta transição.'
        : 'Seu papel não permite executar esta transição.',
    )
  }
  if (regra.exigeResponsavel && !achado.responsavel) {
    throw new TransicaoInvalidaError('Defina um responsável antes de iniciar a correção (RN03).')
  }
  const texto = normalizarJustificativa(justificativa)
  if (regra.exigeJustificativa && !texto) {
    throw new ValidacaoError([
      { campo: 'justificativa', mensagem: 'Esta transição exige justificativa.' },
    ])
  }

  const eventos: EventoNovo[] = [
    {
      tipo: 'Transicao',
      campo: 'status',
      valorAnterior: achado.status,
      valorNovo: destino,
      justificativa: texto,
    },
  ]

  let responsavel = achado.responsavel
  if (regra.removeResponsavel && responsavel) {
    eventos.push({
      tipo: 'TrocaResponsavel',
      campo: 'responsavel',
      valorAnterior: responsavel.nome,
      valorNovo: null,
      justificativa: texto,
    })
    responsavel = null
  }

  // RN06: data de encerramento definida ao encerrar e apagada ao reabrir.
  const encerradoEm = estaEncerrado(destino) ? agora : null

  return {
    achado: { ...achado, status: destino, responsavel, encerradoEm },
    eventos,
  }
}

/**
 * Atribui, troca ou remove o responsável (RF15). Remover o responsável de um achado
 * "Em correção" o devolve a "Aberto" (UC06, fluxo 1a).
 */
export function atribuirResponsavel<T extends EstadoAchado>(
  achado: T,
  novo: (Referencia & { ativo: boolean }) | null,
  ator: Ator,
): Resultado<T> {
  if (!ehGestor(ator)) {
    throw new AcessoNegadoError('Somente analistas e administradores atribuem responsáveis.')
  }
  garantirNaoEncerrado(achado)
  if (novo && !novo.ativo) {
    throw new ValidacaoError([{ campo: 'responsavelId', mensagem: 'Escolha um usuário ativo.' }])
  }
  if ((achado.responsavel?.id ?? null) === (novo?.id ?? null)) {
    return { achado, eventos: [] }
  }

  const eventos: EventoNovo[] = [
    {
      tipo: 'TrocaResponsavel',
      campo: 'responsavel',
      valorAnterior: achado.responsavel?.nome ?? null,
      valorNovo: novo?.nome ?? null,
      justificativa: null,
    },
  ]
  let status = achado.status
  if (!novo && achado.status === 'EmCorrecao') {
    status = 'Aberto'
    eventos.push({
      tipo: 'Transicao',
      campo: 'status',
      valorAnterior: 'EmCorrecao',
      valorNovo: 'Aberto',
      justificativa: 'Responsável removido.',
    })
  }
  const responsavel = novo ? { id: novo.id, nome: novo.nome } : null
  return { achado: { ...achado, responsavel, status }, eventos }
}

/** RN05: achados encerrados não aceitam edição; é preciso reabri-los. */
export function garantirNaoEncerrado(achado: Pick<EstadoAchado, 'status'>): void {
  if (estaEncerrado(achado.status)) {
    throw new ConflitoError('Achado encerrado não pode ser alterado. Reabra-o primeiro.')
  }
}

/** Verifica se o ator pode editar os campos do achado (RF12, RN05). */
export function verificarEdicao(achado: Pick<EstadoAchado, 'status'>, ator: Ator): void {
  if (!ehGestor(ator)) {
    throw new AcessoNegadoError('Somente analistas e administradores editam achados.')
  }
  garantirNaoEncerrado(achado)
}

type ValorCampo = string | number | null

function textoDoValor(valor: ValorCampo): string | null {
  return valor === null ? null : String(valor)
}

/**
 * Compara os campos informados e gera um evento EdicaoCampo por campo alterado (RF20).
 */
export function diferencasDeCampos<C extends string>(
  antes: Record<C, ValorCampo>,
  depois: Partial<Record<C, ValorCampo>>,
): EventoNovo[] {
  const eventos: EventoNovo[] = []
  for (const campo of Object.keys(depois) as C[]) {
    const novo = depois[campo] as ValorCampo
    if (antes[campo] !== novo) {
      eventos.push({
        tipo: 'EdicaoCampo',
        campo,
        valorAnterior: textoDoValor(antes[campo]),
        valorNovo: textoDoValor(novo),
        justificativa: null,
      })
    }
  }
  return eventos
}

export interface AcaoTransicao {
  destino: StatusAchado
  rotulo: string
  exigeJustificativa: boolean
}

/** Transições que o ator pode executar agora, para a interface exibir (RF19). */
export function transicoesPermitidas(achado: EstadoAchado, ator: Ator): AcaoTransicao[] {
  return REGRAS_TRANSICAO.filter(
    (r) =>
      r.origem === achado.status &&
      autorizado(r, achado, ator) &&
      (!r.exigeResponsavel || achado.responsavel !== null),
  ).map((r) => ({
    destino: r.destino,
    rotulo: r.rotulo,
    exigeJustificativa: r.exigeJustificativa,
  }))
}

export interface AcoesPermitidas {
  editar: boolean
  atribuirResponsavel: boolean
  transicoes: AcaoTransicao[]
}

export function acoesPermitidas(achado: EstadoAchado, ator: Ator): AcoesPermitidas {
  const aberto = !estaEncerrado(achado.status)
  return {
    editar: aberto && ehGestor(ator),
    atribuirResponsavel: aberto && ehGestor(ator),
    transicoes: transicoesPermitidas(achado, ator),
  }
}

/**
 * RN09: vencido quando a data-limite é anterior à data atual e o achado não está
 * encerrado. Datas no formato AAAA-MM-DD, comparadas como texto.
 */
export function estaVencido(
  achado: { dataLimite: string | null; status: StatusAchado },
  hoje: string,
): boolean {
  return achado.dataLimite !== null && achado.dataLimite < hoje && !estaEncerrado(achado.status)
}
