import { CAMPOS_ORDENACAO, type CampoOrdenacao } from '@vulncase/compartilhado'

/** Parâmetros de filtro reconhecidos na URL; a URL é a fonte de verdade (RF18). */
export const PARAMETROS_FILTRO = [
  'projetoId',
  'status',
  'severidade',
  'responsavelId',
  'semResponsavel',
  'categoriaOwaspId',
  'ativoId',
  'vencido',
  'busca',
  'ordenarPor',
  'ordem',
  'pagina',
  'tamanhoPagina',
] as const

const REPETIVEIS = new Set(['status', 'severidade'])

/** Converte a URL na consulta da API, ignorando parâmetros desconhecidos e vazios. */
export function consultaDaUrl(params: URLSearchParams): Record<string, string | string[]> {
  const consulta: Record<string, string | string[]> = {}
  for (const nome of PARAMETROS_FILTRO) {
    const valores = params.getAll(nome).filter((v) => v !== '')
    if (valores.length === 0) continue
    consulta[nome] = REPETIVEIS.has(nome) ? valores : valores[0]!
  }
  return consulta
}

export function ordenacaoDaUrl(params: URLSearchParams): {
  campo: CampoOrdenacao
  ordem: 'asc' | 'desc'
} {
  const campo = params.get('ordenarPor')
  return {
    campo: (CAMPOS_ORDENACAO as readonly string[]).includes(campo ?? '')
      ? (campo as CampoOrdenacao)
      : 'criadoEm',
    ordem: params.get('ordem') === 'asc' ? 'asc' : 'desc',
  }
}
