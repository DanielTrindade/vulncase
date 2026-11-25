import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { achados, projetos } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { prefixoUnico } from '../apoio/fabricas.js'

type Ind = {
  total: number
  totalAbertos: number
  porSeveridade: Record<string, number>
  abertosPorSeveridade: Record<string, number>
  porStatus: Record<string, number>
  semResponsavel: number
  vencidos: number
  maisGraves: { codigo: string; severidade: string; vencido: boolean }[]
}

describe('painel', () => {
  let t: AmbienteTeste
  let cookie: string
  let p1: { id: string; prefixo: string }
  let p2: { id: string; prefixo: string }

  const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    const s = await t.sessaoDe('Desenvolvedor')
    cookie = s.cookie
    const analista = await t.criarUsuario('Analista')
    const novo = async (arquivado = false) =>
      (
        await t.db
          .insert(projetos)
          .values({
            prefixo: prefixoUnico(),
            nome: 'P',
            responsavelTecnicoId: analista.id,
            arquivado,
          })
          .returning()
      )[0]!
    p1 = await novo()
    p2 = await novo()
    const p3 = await novo(true)
    let n = 0
    const a = (
      p: { id: string; prefixo: string },
      severidade: string,
      status: string,
      extra: Record<string, unknown> = {},
    ) => ({
      projetoId: p.id,
      codigo: `${p.prefixo}-${String(++n).padStart(4, '0')}`,
      titulo: `A${n}`,
      descricao: 'd',
      origem: 'Outra' as const,
      severidade: severidade as 'Alta',
      status: status as 'Aberto',
      localizacao: 'l',
      correcaoProposta: 'c',
      registradoPorId: analista.id,
      criadoEm: new Date(Date.UTC(2026, 0, 1, 0, n)),
      encerradoEm: ['Corrigido', 'FalsoPositivo', 'RiscoAceito'].includes(status)
        ? new Date()
        : null,
      ...extra,
    })
    // Contagem manual esperada — P1: 6 achados; P2: 2; P3 (arquivado): 1.
    await t.db
      .insert(achados)
      .values([
        a(p1, 'Critica', 'Aberto', { dataLimite: ontem }),
        a(p1, 'Alta', 'EmCorrecao', { responsavelId: s.usuario.id, dataLimite: ontem }),
        a(p1, 'Alta', 'AguardandoVerificacao', { responsavelId: s.usuario.id, dataLimite: amanha }),
        a(p1, 'Media', 'Corrigido', { dataLimite: ontem }),
        a(p1, 'Baixa', 'FalsoPositivo'),
        a(p1, 'Informativa', 'RiscoAceito'),
        a(p2, 'Critica', 'Aberto'),
        a(p2, 'Media', 'Aberto', { responsavelId: s.usuario.id }),
        a(p3, 'Critica', 'Corrigido'),
      ])
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('painel do projeto confere com a contagem manual', async () => {
    const res = await t.requisitar(`/api/projetos/${p1.id}/painel`, { cookie })
    expect(res.status).toBe(200)
    const p = (await res.json()) as Ind & { projeto: { id: string } }
    expect(p.projeto.id).toBe(p1.id)
    expect(p.total).toBe(6)
    expect(p.totalAbertos).toBe(3)
    expect(p.porSeveridade).toEqual({ Critica: 1, Alta: 2, Media: 1, Baixa: 1, Informativa: 1 })
    expect(p.abertosPorSeveridade).toEqual({
      Critica: 1,
      Alta: 2,
      Media: 0,
      Baixa: 0,
      Informativa: 0,
    })
    expect(p.porStatus).toEqual({
      Aberto: 1,
      EmCorrecao: 1,
      AguardandoVerificacao: 1,
      Corrigido: 1,
      FalsoPositivo: 1,
      RiscoAceito: 1,
    })
    expect(p.semResponsavel).toBe(1)
    // Vencidos: Crítica aberta e Alta em correção; o Corrigido com data passada não conta (RN09).
    expect(p.vencidos).toBe(2)
    expect(p.maisGraves.map((m) => m.severidade)).toEqual(['Critica', 'Alta', 'Alta'])
    expect(p.maisGraves[0]!.vencido).toBe(true)
  })

  it('painel geral agrega apenas os projetos ativos', async () => {
    const res = await t.requisitar('/api/painel', { cookie })
    const g = (await res.json()) as Ind & { projetosAtivos: number }
    expect(g.projetosAtivos).toBe(2)
    expect(g.total).toBe(8)
    expect(g.totalAbertos).toBe(5)
    expect(g.porSeveridade.Critica).toBe(2)
    expect(g.porStatus.Aberto).toBe(3)
    expect(g.semResponsavel).toBe(2)
    expect(g.vencidos).toBe(2)
    // Mais graves: severidade e depois data de registro mais antiga.
    expect(g.maisGraves.map((m) => m.codigo)).toEqual([
      `${p1.prefixo}-0001`,
      `${p2.prefixo}-0007`,
      `${p1.prefixo}-0002`,
      `${p1.prefixo}-0003`,
      `${p2.prefixo}-0008`,
    ])
  })

  it('limita a lista de mais graves a dez', async () => {
    const analista = await t.criarUsuario('Analista')
    const [p] = await t.db
      .insert(projetos)
      .values({ prefixo: prefixoUnico(), nome: 'Muitos', responsavelTecnicoId: analista.id })
      .returning()
    await t.db.insert(achados).values(
      Array.from({ length: 12 }, (_, i) => ({
        projetoId: p!.id,
        codigo: `${p!.prefixo}-${String(i + 1).padStart(4, '0')}`,
        titulo: 't',
        descricao: 'd',
        origem: 'Outra' as const,
        severidade: 'Baixa' as const,
        localizacao: 'l',
        correcaoProposta: 'c',
        registradoPorId: analista.id,
      })),
    )
    const res = await t.requisitar(`/api/projetos/${p!.id}/painel`, { cookie })
    expect(((await res.json()) as Ind).maisGraves).toHaveLength(10)
  })

  it('projeto sem achados tem indicadores zerados; inexistente retorna 404', async () => {
    const analista = await t.criarUsuario('Analista')
    const [vazio] = await t.db
      .insert(projetos)
      .values({ prefixo: prefixoUnico(), nome: 'Vazio', responsavelTecnicoId: analista.id })
      .returning()
    const p = (await (
      await t.requisitar(`/api/projetos/${vazio!.id}/painel`, { cookie })
    ).json()) as Ind
    expect(p).toMatchObject({
      total: 0,
      totalAbertos: 0,
      semResponsavel: 0,
      vencidos: 0,
      maisGraves: [],
    })
    expect(
      (await t.requisitar('/api/projetos/00000000-0000-4000-8000-000000000000/painel', { cookie }))
        .status,
    ).toBe(404)
  })
})
