import { z } from 'zod'
import { ORIGENS_ACHADO, SEVERIDADES, STATUS_ACHADO } from '../enums.js'
import { textoObrigatorio, textoOpcional, uuid } from './comum.js'

export const CWE_MAXIMO = 9999

const inteiroOpcional = (max: number, mensagem: string) =>
  z
    .number(mensagem)
    .int(mensagem)
    .min(1, mensagem)
    .max(max, mensagem)
    .nullish()
    .transform((v) => v ?? null)

export const esquemaCve = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^CVE-\d{4}-\d{4,7}$/, 'Use o formato CVE-AAAA-NNNN.')

/** Campos descritivos do achado, comuns ao registro e à edição (RF12, RF14, RF23). */
const camposAchado = {
  titulo: textoObrigatorio(160),
  descricao: textoObrigatorio(10_000),
  origem: z.enum(ORIGENS_ACHADO, 'Origem inválida.'),
  severidade: z.enum(SEVERIDADES, 'Severidade inválida.'),
  localizacao: textoObrigatorio(500),
  impacto: textoOpcional(4000),
  passosReproducao: textoOpcional(10_000),
  correcaoProposta: textoObrigatorio(10_000),
  categoriaOwaspId: inteiroOpcional(1000, 'Categoria inválida.'),
  cweId: inteiroOpcional(CWE_MAXIMO, `Informe o número da CWE (1 a ${CWE_MAXIMO}).`),
  cveId: esquemaCve
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || null),
  notaCvss: z
    .number('Nota inválida.')
    .min(0, 'A nota vai de 0,0 a 10,0.')
    .max(10, 'A nota vai de 0,0 a 10,0.')
    .refine((v) => Math.abs(Math.round(v * 10) - v * 10) < 1e-9, 'Use uma casa decimal.')
    .nullish()
    .transform((v) => v ?? null),
}

/**
 * Registro de achado. Só aceita campos editáveis: status, código, autor e datas são
 * definidos pelo servidor (A16).
 */
const dataIso = z.iso.date('Data inválida.')

export const esquemaCriarAchado = z.strictObject({
  ...camposAchado,
  responsavelId: uuid.nullish().transform((v) => v ?? null),
  /** RF24: vazio = calculada pela severidade (RN10); informada = ajuste manual. */
  dataLimite: dataIso
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || undefined),
})
export type EntradaCriarAchado = z.infer<typeof esquemaCriarAchado>
export type FormularioCriarAchado = z.input<typeof esquemaCriarAchado>

/** Edição: mesmos campos descritivos e a versão lida, para concorrência otimista (DT08). */
export const esquemaEditarAchado = z.strictObject({
  ...camposAchado,
  /** Omitida = mantém (ou recalcula se a severidade mudar); vazia = sem prazo. */
  dataLimite: dataIso
    .nullable()
    .or(z.literal('').transform(() => null))
    .optional(),
  versao: z.number().int().min(1),
})
export type EntradaEditarAchado = z.infer<typeof esquemaEditarAchado>

export const CAMPOS_EDITAVEIS_ACHADO = Object.keys(camposAchado) as (keyof typeof camposAchado)[]

export const esquemaAtribuirResponsavel = z.strictObject({
  responsavelId: uuid.nullable(),
  versao: z.number().int().min(1),
})
export type EntradaAtribuirResponsavel = z.infer<typeof esquemaAtribuirResponsavel>

export const esquemaTransicao = z.strictObject({
  destino: z.enum(STATUS_ACHADO, 'Status inválido.'),
  justificativa: textoOpcional(4000),
  versao: z.number().int().min(1),
})
export type EntradaTransicao = z.infer<typeof esquemaTransicao>

/** Aceita um valor ou um parâmetro repetido (?status=A&status=B). */
const repetivel = <T extends readonly [string, ...string[]]>(valores: T, mensagem: string) =>
  z
    .union([z.enum(valores, mensagem), z.array(z.enum(valores, mensagem)).max(valores.length)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))

const booleanoTexto = z
  .enum(['true', 'false'], 'Use true ou false.')
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

/** Campos de ordenação aceitos: lista fechada (A04). */
export const CAMPOS_ORDENACAO = ['severidade', 'criadoEm', 'dataLimite'] as const
export type CampoOrdenacao = (typeof CAMPOS_ORDENACAO)[number]
export const TAMANHO_PAGINA_MAXIMO = 100

/** Filtros de GET /api/achados (RF18). Parâmetros desconhecidos são recusados. */
export const esquemaFiltroAchados = z.strictObject({
  projetoId: uuid.optional(),
  status: repetivel(STATUS_ACHADO, 'Status inválido.'),
  severidade: repetivel(SEVERIDADES, 'Severidade inválida.'),
  responsavelId: uuid.optional(),
  semResponsavel: booleanoTexto,
  categoriaOwaspId: z.coerce.number().int().min(1).max(1000).optional(),
  vencido: booleanoTexto,
  busca: z.string().trim().max(100, 'Máximo de 100 caracteres.').optional(),
  ordenarPor: z.enum(CAMPOS_ORDENACAO, 'Ordenação inválida.').default('criadoEm'),
  ordem: z.enum(['asc', 'desc'], 'Use asc ou desc.').default('desc'),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  tamanhoPagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(TAMANHO_PAGINA_MAXIMO, `No máximo ${TAMANHO_PAGINA_MAXIMO} por página.`)
    .default(20),
})
export type FiltroAchados = z.infer<typeof esquemaFiltroAchados>
export type ConsultaAchados = z.input<typeof esquemaFiltroAchados>
