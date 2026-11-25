import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Papel } from '@vulncase/compartilhado'
import { analistaOuAdministrador, somenteAdministrador } from '../../src/middlewares/autorizacao.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'

describe('exigirPapel', () => {
  let t: AmbienteTeste
  const cookies = {} as Record<Papel, string>

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    t.app.get('/api/teste/admin', somenteAdministrador(), (c) => c.json({ ok: true }))
    t.app.get('/api/teste/analista', analistaOuAdministrador(), (c) => c.json({ ok: true }))
    for (const papel of ['Administrador', 'Analista', 'Desenvolvedor'] as const) {
      cookies[papel] = (await t.sessaoDe(papel)).cookie
    }
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it.each([
    ['Administrador', 200],
    ['Analista', 403],
    ['Desenvolvedor', 403],
  ] as const)('rota de Administrador acessada por %s retorna %i', async (papel, status) => {
    const res = await t.requisitar('/api/teste/admin', { cookie: cookies[papel] })
    expect(res.status).toBe(status)
  })

  it.each([
    ['Administrador', 200],
    ['Analista', 200],
    ['Desenvolvedor', 403],
  ] as const)('rota de Analista acessada por %s retorna %i', async (papel, status) => {
    const res = await t.requisitar('/api/teste/analista', { cookie: cookies[papel] })
    expect(res.status).toBe(status)
  })

  it('sem sessão retorna 401 antes da verificação de papel', async () => {
    expect((await t.requisitar('/api/teste/admin')).status).toBe(401)
  })

  it('registra a negação no log', async () => {
    await t.requisitar('/api/teste/admin', { cookie: cookies.Desenvolvedor })
    expect(
      t.linhas().some((l) => l.evento === 'autorizacao.negada' && l.papel === 'Desenvolvedor'),
    ).toBe(true)
  })
})
