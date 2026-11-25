import { describe, expect, it } from 'vitest'
import { gerarHash, verificar, verificarFicticio } from '../../src/infra/senha.js'

describe('senha (Argon2id)', () => {
  it('gera hash no formato $argon2id$ com sal aleatório', async () => {
    const h1 = await gerarHash('uma-senha-segura')
    const h2 = await gerarHash('uma-senha-segura')
    expect(h1).toMatch(/^\$argon2id\$/)
    expect(h1).not.toBe(h2)
    expect(h1).not.toContain('uma-senha-segura')
  })

  it('verifica a senha correta e recusa a errada', async () => {
    const h = await gerarHash('uma-senha-segura')
    expect(await verificar(h, 'uma-senha-segura')).toBe(true)
    expect(await verificar(h, 'outra-senha-qualquer')).toBe(false)
  })

  it('retorna false para hash malformado em vez de lançar', async () => {
    expect(await verificar('nao-e-um-hash', 'x')).toBe(false)
  })

  it('verificação fictícia sempre falha', async () => {
    expect(await verificarFicticio('qualquer')).toBe(false)
  })
})
