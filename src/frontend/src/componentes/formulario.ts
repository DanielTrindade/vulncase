import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ErroApi, mensagemDeErro } from '../api/cliente'

/**
 * Copia os erros de campo devolvidos pela API (400) para o formulário e devolve a
 * mensagem geral a exibir. Os valores digitados são mantidos.
 */
export function aplicarErrosApi<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  campos: readonly string[],
): string {
  if (err instanceof ErroApi && err.problema.errors) {
    let algum = false
    for (const e of err.problema.errors) {
      if (campos.includes(e.campo)) {
        setError(e.campo as Path<T>, { type: 'api', message: e.mensagem })
        algum = true
      }
    }
    if (algum) return 'Corrija os campos indicados.'
  }
  return mensagemDeErro(err)
}
