import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { eventosHistorico, projetos } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import {
  achadoValido,
  criarAchadoApi,
  criarProjetoApi,
  type AchadoResposta,
} from '../apoio/fabricas.js'

describe('registro, edição e detalhe de achado', () => {
  let t: AmbienteTeste
  let analista: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let dev: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let projeto: { id: string; prefixo: string }

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    projeto = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('registra achado com código sequencial, status Aberto e evento de criação', async () => {
    const res = await t.requisitar(`/api/projetos/${projeto.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido(),
    })
    expect(res.status).toBe(201)
    const a = (await res.json()) as AchadoResposta
    expect(res.headers.get('location')).toBe(`/api/achados/${a.id}`)
    expect(a.codigo).toBe(`${projeto.prefixo}-0001`)
    expect(a).toMatchObject({
      status: 'Aberto',
      versao: 1,
      cweId: 319,
      categoriaOwasp: { id: 2, codigo: 'A02', versao: '2021' },
      registradoPor: { id: analista.usuario.id },
      responsavel: null,
      encerradoEm: null,
    })
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({
      tipo: 'Criacao',
      valorNovo: a.codigo,
      autorId: analista.usuario.id,
    })

    const segundo = await criarAchadoApi(t, analista.cookie, projeto.id)
    expect(segundo.codigo).toBe(`${projeto.prefixo}-0002`)
  })

  it('vinte registros simultâneos geram vinte códigos distintos e sequenciais', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    const resultados = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        criarAchadoApi(t, analista.cookie, p.id, { titulo: `Achado ${i}` }),
      ),
    )
    const codigos = resultados.map((r) => r.codigo).sort()
    const esperados = Array.from(
      { length: 20 },
      (_, i) => `${p.prefixo}-${String(i + 1).padStart(4, '0')}`,
    )
    expect(codigos).toEqual(esperados)
    const [linha] = await t.db.select().from(projetos).where(eq(projetos.id, p.id))
    expect(linha!.proximoNumeroAchado).toBe(21)
  })

  it('registra com responsável ativo e grava a troca de responsável', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projeto.id, {
      responsavelId: dev.usuario.id,
    })
    expect(a.responsavel).toEqual({ id: dev.usuario.id, nome: dev.usuario.nome })
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
      .orderBy(asc(eventosHistorico.tipo))
    expect(eventos.map((e) => e.tipo)).toEqual(['Criacao', 'TrocaResponsavel'])
  })

  it('responsável inativo retorna 400', async () => {
    const inativo = await t.criarUsuario('Desenvolvedor', { ativo: false })
    const res = await t.requisitar(`/api/projetos/${projeto.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido({ responsavelId: inativo.id }),
    })
    expect(res.status).toBe(400)
  })

  it.each([
    ['status', { status: 'Corrigido' }],
    ['registradoPorId', { registradoPorId: '00000000-0000-4000-8000-000000000000' }],
    ['codigo', { codigo: 'XXX-9999' }],
    ['projetoId', { projetoId: '00000000-0000-4000-8000-000000000000' }],
  ])('envio de %s no corpo é rejeitado (400)', async (_campo, extra) => {
    const res = await t.requisitar(`/api/projetos/${projeto.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido(extra),
    })
    expect(res.status).toBe(400)
  })

  it.each([
    ['título vazio', { titulo: '   ' }],
    ['título longo', { titulo: 'x'.repeat(161) }],
    ['severidade inválida', { severidade: 'Gravissima' }],
    ['origem inválida', { origem: 'Scanner' }],
    ['CWE zero', { cweId: 0 }],
    ['CWE texto', { cweId: '79' }],
    ['categoria inexistente', { categoriaOwaspId: 999 }],
    ['CVE malformado', { cveId: 'CVE-21-1' }],
    ['CVSS acima de 10', { notaCvss: 10.5 }],
    ['CVSS com duas casas', { notaCvss: 7.25 }],
    ['sem correção proposta', { correcaoProposta: undefined }],
  ])('%s retorna 400', async (_nome, extra) => {
    const res = await t.requisitar(`/api/projetos/${projeto.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido(extra),
    })
    expect(res.status).toBe(400)
  })

  it('aceita CVE e CVSS opcionais (RF23)', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projeto.id, {
      cveId: 'cve-2021-44228',
      notaCvss: 10,
    })
    expect(a).toMatchObject({ cveId: 'CVE-2021-44228', notaCvss: 10 })
  })

  it('desenvolvedor recebe 403 ao registrar', async () => {
    const res = await t.requisitar(`/api/projetos/${projeto.id}/achados`, {
      metodo: 'POST',
      cookie: dev.cookie,
      corpo: achadoValido(),
    })
    expect(res.status).toBe(403)
  })

  it('projeto arquivado recusa o registro (409); inexistente retorna 404', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
      metodo: 'POST',
      cookie: analista.cookie,
    })
    const res = await t.requisitar(`/api/projetos/${p.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido(),
    })
    expect(res.status).toBe(409)
    const res404 = await t.requisitar(
      '/api/projetos/00000000-0000-4000-8000-000000000000/achados',
      {
        metodo: 'POST',
        cookie: analista.cookie,
        corpo: achadoValido(),
      },
    )
    expect(res404.status).toBe(404)
  })

  it('detalhe traz ações conforme o papel', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projeto.id, {
      responsavelId: dev.usuario.id,
    })
    const comoAnalista = (await (
      await t.requisitar(`/api/achados/${a.id}`, { cookie: analista.cookie })
    ).json()) as AchadoResposta
    expect(comoAnalista.acoes.editar).toBe(true)
    expect(comoAnalista.acoes.transicoes.map((x) => x.destino).sort()).toEqual([
      'EmCorrecao',
      'FalsoPositivo',
    ])
    const comoDev = (await (
      await t.requisitar(`/api/achados/${a.id}`, { cookie: dev.cookie })
    ).json()) as AchadoResposta
    expect(comoDev.acoes).toEqual({
      editar: false,
      atribuirResponsavel: false,
      anexarEvidencia: true,
      comentar: true,
      transicoes: [],
    })
  })

  it('detalhe de achado inexistente retorna 404', async () => {
    const res = await t.requisitar('/api/achados/00000000-0000-4000-8000-000000000000', {
      cookie: dev.cookie,
    })
    expect(res.status).toBe(404)
  })

  describe('edição', () => {
    it('altera campos, incrementa a versão e grava um evento por campo', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      const res = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: analista.cookie,
        corpo: achadoValido({
          severidade: 'Critica',
          cweId: 523,
          categoriaOwaspId: 5,
          impacto: '',
          versao: 1,
        }),
      })
      expect(res.status).toBe(200)
      const novo = (await res.json()) as AchadoResposta
      expect(novo).toMatchObject({ severidade: 'Critica', cweId: 523, versao: 2, impacto: null })
      const eventos = await t.db
        .select()
        .from(eventosHistorico)
        .where(eq(eventosHistorico.achadoId, a.id))
      const edicoes = eventos.filter((e) => e.tipo === 'EdicaoCampo')
      expect(edicoes.map((e) => e.campo).sort()).toEqual([
        'categoriaOwasp',
        'cweId',
        'dataLimite',
        'impacto',
        'severidade',
      ])
      expect(edicoes.find((e) => e.campo === 'severidade')).toMatchObject({
        valorAnterior: 'Alta',
        valorNovo: 'Critica',
      })
      expect(edicoes.find((e) => e.campo === 'categoriaOwasp')?.valorNovo).toContain('A05')
    })

    it('sem alterações não grava evento nem muda a versão', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      const res = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: analista.cookie,
        corpo: achadoValido({ versao: 1 }),
      })
      expect(((await res.json()) as AchadoResposta).versao).toBe(1)
    })

    it('versão desatualizada retorna 409', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      const corpo = (titulo: string) => achadoValido({ titulo, versao: 1 })
      const r1 = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: analista.cookie,
        corpo: corpo('A'),
      })
      const r2 = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: analista.cookie,
        corpo: corpo('B'),
      })
      expect(r1.status).toBe(200)
      expect(r2.status).toBe(409)
    })

    it('edições simultâneas com a mesma versão: só uma vence', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      const respostas = await Promise.all(
        ['X', 'Y', 'Z'].map((titulo) =>
          t.requisitar(`/api/achados/${a.id}`, {
            metodo: 'PUT',
            cookie: analista.cookie,
            corpo: achadoValido({ titulo, versao: 1 }),
          }),
        ),
      )
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409])
    })

    it('rejeita status e registradoPorId na edição', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      for (const extra of [
        { status: 'Corrigido' },
        { registradoPorId: dev.usuario.id },
        { responsavelId: dev.usuario.id },
      ]) {
        const res = await t.requisitar(`/api/achados/${a.id}`, {
          metodo: 'PUT',
          cookie: analista.cookie,
          corpo: achadoValido({ ...extra, versao: 1 }),
        })
        expect(res.status).toBe(400)
      }
    })

    it('RN05: achado encerrado não é editado (409)', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id)
      await t.requisitar(`/api/achados/${a.id}/transicoes`, {
        metodo: 'POST',
        cookie: analista.cookie,
        corpo: { destino: 'FalsoPositivo', justificativa: 'Não reproduz.', versao: 1 },
      })
      const atual = (await (
        await t.requisitar(`/api/achados/${a.id}`, { cookie: analista.cookie })
      ).json()) as AchadoResposta
      expect(atual.status).toBe('FalsoPositivo')
      const res = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: analista.cookie,
        corpo: achadoValido({ versao: atual.versao }),
      })
      expect(res.status).toBe(409)
    })

    it('desenvolvedor recebe 403 ao editar', async () => {
      const a = await criarAchadoApi(t, analista.cookie, projeto.id, {
        responsavelId: dev.usuario.id,
      })
      const res = await t.requisitar(`/api/achados/${a.id}`, {
        metodo: 'PUT',
        cookie: dev.cookie,
        corpo: achadoValido({ versao: 1 }),
      })
      expect(res.status).toBe(403)
    })
  })

  it('catálogo OWASP lista as dez categorias', async () => {
    const res = await t.requisitar('/api/categorias-owasp', { cookie: dev.cookie })
    const { itens } = (await res.json()) as { itens: { codigo: string }[] }
    expect(itens.map((i) => i.codigo)).toEqual([
      'A01',
      'A02',
      'A03',
      'A04',
      'A05',
      'A06',
      'A07',
      'A08',
      'A09',
      'A10',
    ])
  })
})
