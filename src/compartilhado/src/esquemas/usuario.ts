import { z } from 'zod'
import { PAPEIS } from '../enums.js'
import { textoObrigatorio } from './comum.js'

/** RNF02: mínimo de 10 caracteres. O máximo evita custo excessivo do hash. */
export const SENHA_MINIMO = 10
export const SENHA_MAXIMO = 128

export const esquemaSenha = z
  .string()
  .min(SENHA_MINIMO, `A senha deve ter no mínimo ${SENHA_MINIMO} caracteres.`)
  .max(SENHA_MAXIMO, `A senha deve ter no máximo ${SENHA_MAXIMO} caracteres.`)

export const esquemaEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('E-mail inválido.'))

export const esquemaPapel = z.enum(PAPEIS, 'Papel inválido.')

export const esquemaLogin = z.strictObject({
  email: esquemaEmail,
  // Na entrada não se aplica o mínimo, para não revelar a política em mensagens distintas.
  senha: z.string().min(1, 'Informe a senha.').max(SENHA_MAXIMO),
})
export type EntradaLogin = z.infer<typeof esquemaLogin>

export const esquemaCriarUsuario = z.strictObject({
  nome: textoObrigatorio(120),
  email: esquemaEmail,
  papel: esquemaPapel,
  senha: esquemaSenha,
})
export type EntradaCriarUsuario = z.infer<typeof esquemaCriarUsuario>

export const esquemaAlterarUsuario = z
  .strictObject({
    papel: esquemaPapel.optional(),
    ativo: z.boolean().optional(),
  })
  .refine((v) => v.papel !== undefined || v.ativo !== undefined, {
    message: 'Informe papel ou ativo.',
  })
export type EntradaAlterarUsuario = z.infer<typeof esquemaAlterarUsuario>

export const esquemaTrocarSenha = z
  .strictObject({
    senhaAtual: z.string().min(1, 'Informe a senha atual.').max(SENHA_MAXIMO),
    novaSenha: esquemaSenha,
  })
  .refine((v) => v.senhaAtual !== v.novaSenha, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['novaSenha'],
  })
export type EntradaTrocarSenha = z.infer<typeof esquemaTrocarSenha>
