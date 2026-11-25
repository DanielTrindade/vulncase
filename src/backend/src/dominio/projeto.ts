import { REGEX_PREFIXO } from '@vulncase/compartilhado'

export const NUMERO_MAXIMO_ACHADO = 9999

/**
 * RN02: código do achado = prefixo do projeto + número sequencial de 4 dígitos.
 * Ex.: gerarCodigoAchado('WEB', 7) === 'WEB-0007'.
 */
export function gerarCodigoAchado(prefixo: string, numero: number): string {
  if (!REGEX_PREFIXO.test(prefixo)) {
    throw new RangeError('Prefixo inválido.')
  }
  if (!Number.isInteger(numero) || numero < 1 || numero > NUMERO_MAXIMO_ACHADO) {
    throw new RangeError(`O número do achado deve estar entre 1 e ${NUMERO_MAXIMO_ACHADO}.`)
  }
  return `${prefixo}-${String(numero).padStart(4, '0')}`
}
