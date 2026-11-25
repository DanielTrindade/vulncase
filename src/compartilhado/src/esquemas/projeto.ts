import { z } from 'zod'
import { textoObrigatorio, textoOpcional, uuid } from './comum.js'

/** RN02: prefixo de 2 a 5 letras maiúsculas, único na instância. */
export const REGEX_PREFIXO = /^[A-Z]{2,5}$/

export const esquemaPrefixo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(REGEX_PREFIXO, 'O prefixo deve ter de 2 a 5 letras (A–Z).')

export const esquemaProjeto = z.strictObject({
  prefixo: esquemaPrefixo,
  nome: textoObrigatorio(120),
  descricao: textoOpcional(4000),
  responsavelTecnicoId: uuid,
})
export type EntradaProjeto = z.infer<typeof esquemaProjeto>
export type FormularioProjeto = z.input<typeof esquemaProjeto>

export const esquemaFiltroProjetos = z.strictObject({
  arquivados: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})
