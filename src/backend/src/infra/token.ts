import { createHash, randomBytes } from 'node:crypto'

/** Token de sessão: 32 bytes aleatórios em base64url (RNF04). */
export function gerarTokenSessao(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 em hexadecimal (64 caracteres). Apenas o hash é gravado no banco (A18). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
