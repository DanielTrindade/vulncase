import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEVERIDADES, STATUS_ACHADO } from '@vulncase/compartilhado'
import { eq } from 'drizzle-orm'
import { achados, eventosHistorico } from '../../src/db/schema.js'
import { carregarDemonstracao } from '../../src/db/seed.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'

describe('carga de demonstração', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('carrega usuários, projetos e achados com todos os status e severidades', async () => {
    expect(await carregarDemonstracao(t.db, t.log, 'senha-demo-teste')).toBe('carregado')
    const todos = await t.db.select().from(achados)
    expect(new Set(todos.map((a) => a.status))).toEqual(new Set(STATUS_ACHADO))
    expect(new Set(todos.map((a) => a.severidade))).toEqual(new Set(SEVERIDADES))
    expect(todos.map((a) => a.codigo)).toContain('REDE-0001')
    expect(todos.map((a) => a.codigo)).toContain('WEB-0001')
    expect(todos.map((a) => a.codigo)).toContain('COD-0001')
  })

  it('todos os indicadores do painel ficam maiores que zero', async () => {
    const cookie = await t.entrar('dev@demo.vulncase.local', 'senha-demo-teste')
    const p = (await (await t.requisitar('/api/painel', { cookie })).json()) as {
      total: number
      totalAbertos: number
      semResponsavel: number
      vencidos: number
      porSeveridade: Record<string, number>
      porStatus: Record<string, number>
      maisGraves: unknown[]
    }
    expect(p.total).toBeGreaterThan(0)
    expect(p.totalAbertos).toBeGreaterThan(0)
    expect(p.semResponsavel).toBeGreaterThan(0)
    expect(p.vencidos).toBeGreaterThan(0)
    expect(p.maisGraves.length).toBeGreaterThan(0)
    for (const v of [...Object.values(p.porSeveridade), ...Object.values(p.porStatus)])
      expect(v).toBeGreaterThan(0)
  })

  it('o histórico é coerente com o status atual', async () => {
    const [cod] = await t.db.select().from(achados).where(eq(achados.codigo, 'COD-0001'))
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, cod!.id))
    const transicoes = eventos.filter((e) => e.tipo === 'Transicao')
    expect(transicoes.at(-1)?.valorNovo).toBe(cod!.status)
    expect(eventos[0]?.tipo).toBe('Criacao')
  })

  it('é idempotente', async () => {
    const antes = (await t.db.select().from(achados)).length
    expect(await carregarDemonstracao(t.db, t.log, 'senha-demo-teste')).toBe('existente')
    expect((await t.db.select().from(achados)).length).toBe(antes)
  })
})
