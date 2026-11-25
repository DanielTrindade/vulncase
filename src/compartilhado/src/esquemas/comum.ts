import { z } from 'zod'

/** Texto obrigatório: remove espaços nas pontas e exige ao menos um caractere. */
export const textoObrigatorio = (max: number) =>
  z.string().trim().min(1, 'Campo obrigatório.').max(max, `Máximo de ${max} caracteres.`)

/** Texto opcional: string vazia vira null. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null))

export const uuid = z.uuid('Identificador inválido.')

export const paramId = z.strictObject({ id: uuid })
