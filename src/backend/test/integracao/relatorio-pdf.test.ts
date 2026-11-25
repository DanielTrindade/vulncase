import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarDemonstracao } from '../../src/db/seed.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'

describe('GET /api/projetos/{id}/relatorio.pdf', () => {
  let t: AmbienteTeste
  let cookie: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    await carregarDemonstracao(t.db, t.log, 'senha-demo-teste')
    cookie = await t.entrar('dev@demo.vulncase.local', 'senha-demo-teste')
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('gera PDF dos dados de demonstração como anexo', async () => {
    const projetos = (await (await t.requisitar('/api/projetos', { cookie })).json()) as {
      itens: { id: string; prefixo: string }[]
    }
    for (const p of projetos.itens) {
      const res = await t.requisitar(`/api/projetos/${p.id}/relatorio.pdf`, { cookie })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/pdf')
      expect(res.headers.get('content-disposition')).toMatch(
        new RegExp(`^attachment; filename="${p.prefixo}-relatorio-`),
      )
      const bytes = new Uint8Array(await res.arrayBuffer())
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
      expect(bytes.byteLength).toBeGreaterThan(5000)
    }
  })

  it('projeto inexistente retorna 404', async () => {
    const res = await t.requisitar(
      '/api/projetos/00000000-0000-4000-8000-000000000000/relatorio.pdf',
      { cookie },
    )
    expect(res.status).toBe(404)
  })
})
