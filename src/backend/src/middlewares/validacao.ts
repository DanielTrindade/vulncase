import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'
import { ValidacaoError } from '../dominio/erros.js'

/**
 * Valida corpo, parâmetros ou consulta com Zod (RNF07). Em caso de falha lança
 * ValidacaoError, convertido em 400 com a lista de campos pelo tratador global.
 */
export function validar<T extends ZodType, A extends keyof ValidationTargets>(alvo: A, esquema: T) {
  return zValidator(alvo, esquema, (resultado) => {
    if (!resultado.success) {
      const erros = resultado.error.issues.map((i) => ({
        campo: i.path.length > 0 ? i.path.join('.') : alvo,
        mensagem: i.message,
      }))
      throw new ValidacaoError(erros)
    }
  })
}
