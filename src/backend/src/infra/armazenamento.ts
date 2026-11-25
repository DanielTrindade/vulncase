import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

const REGEX_NOME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * Armazenamento de evidências em diretório fora da raiz pública (DT09). O nome em
 * disco é sempre um UUID gerado aqui, sem extensão fornecida pelo usuário, o que
 * impede travessia de caminho e sobrescrita.
 */
export class Armazenamento {
  constructor(private readonly diretorio: string) {}

  private caminho(nome: string): string {
    if (!REGEX_NOME.test(nome)) throw new Error('nome de armazenamento inválido')
    return path.join(this.diretorio, nome)
  }

  async gravar(conteudo: Uint8Array): Promise<string> {
    await mkdir(this.diretorio, { recursive: true, mode: 0o700 })
    const nome = randomUUID()
    // 'wx' falha se o arquivo já existir; 0o600 deixa o arquivo legível só pela API.
    const arquivo = await open(this.caminho(nome), 'wx', 0o600)
    try {
      await arquivo.writeFile(conteudo)
    } finally {
      await arquivo.close()
    }
    return nome
  }

  async ler(nome: string): Promise<Buffer> {
    return readFile(this.caminho(nome))
  }

  async remover(nome: string): Promise<void> {
    await rm(this.caminho(nome), { force: true })
  }
}
