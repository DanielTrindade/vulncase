import { hash, verify } from '@node-rs/argon2'

/**
 * Hash de senha com Argon2id (RNF01), parâmetros padrão da biblioteca
 * (algoritmo Argon2id, 19 MiB, 2 iterações, paralelismo 1) e sal aleatório.
 */
export async function gerarHash(senha: string): Promise<string> {
  return hash(senha)
}

export async function verificar(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha)
  } catch {
    return false
  }
}

let hashFicticio: Promise<string> | undefined

/**
 * Executa uma verificação contra um hash fictício. Usado quando o e-mail não existe,
 * para que a resposta leve aproximadamente o mesmo tempo de uma senha errada (A01).
 */
export async function verificarFicticio(senha: string): Promise<false> {
  hashFicticio ??= gerarHash('senha-ficticia-para-equalizar-tempo')
  await verificar(await hashFicticio, senha)
  return false
}
