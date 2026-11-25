import { describe, expect, it } from 'vitest'
import { carregarConfig, ConfiguracaoInvalidaError } from '../../src/config.js'

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  ORIGEM_PERMITIDA: 'https://localhost/',
}

describe('carregarConfig', () => {
  it('aceita configuração mínima e aplica padrões', () => {
    const c = carregarConfig(base)
    expect(c.origemPermitida).toBe('https://localhost')
    expect(c.evidenciasTamanhoMaximoBytes).toBe(5_242_880)
    expect(c.ambiente).toBe('production')
  })

  it.each(['DATABASE_URL', 'ORIGEM_PERMITIDA'])('recusa iniciar sem %s', (variavel) => {
    const env: Record<string, string> = { ...base }
    delete env[variavel]
    expect(() => carregarConfig(env)).toThrow(ConfiguracaoInvalidaError)
    try {
      carregarConfig(env)
    } catch (err) {
      expect((err as ConfiguracaoInvalidaError).campos).toContain(variavel)
    }
  })

  it('trata variável vazia como ausente', () => {
    expect(() => carregarConfig({ ...base, DATABASE_URL: '' })).toThrow(ConfiguracaoInvalidaError)
  })

  it('não inclui valores na mensagem de erro', () => {
    try {
      carregarConfig({ ...base, ADMIN_SENHA_INICIAL: 'curta' })
      expect.unreachable()
    } catch (err) {
      expect((err as Error).message).not.toContain('curta')
      expect((err as ConfiguracaoInvalidaError).campos).toEqual(['ADMIN_SENHA_INICIAL'])
    }
  })
})
