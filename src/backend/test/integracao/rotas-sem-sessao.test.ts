import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'

const PUBLICAS = new Set(['GET /api/health', 'POST /api/auth/login'])

describe('nenhuma rota além de login e health responde sem sessão', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('todas as rotas registradas sob /api retornam 401 sem cookie', async () => {
    const rotas = t.app.routes.filter(
      (r) => r.path.startsWith('/api/') && r.method !== 'ALL' && !r.path.endsWith('*'),
    )
    expect(rotas.length).toBeGreaterThan(2)
    for (const rota of rotas) {
      const chave = `${rota.method} ${rota.path}`
      if (PUBLICAS.has(chave)) continue
      const caminho = rota.path.replace(/:[A-Za-z]+/g, '00000000-0000-4000-8000-000000000000')
      const res = await t.requisitar(caminho, {
        metodo: rota.method,
        corpo: rota.method === 'GET' ? undefined : {},
      })
      expect(res.status, chave).toBe(401)
    }
  })
})
