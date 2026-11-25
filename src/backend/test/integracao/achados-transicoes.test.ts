import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { eventosHistorico } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { criarAchadoApi, criarProjetoApi, type AchadoResposta } from '../apoio/fabricas.js'

type Sessao = Awaited<ReturnType<AmbienteTeste['sessaoDe']>>

describe('responsável e transições', () => {
  let t: AmbienteTeste
  let admin: Sessao
  let analista: Sessao
  let dev: Sessao
  let outroDev: Sessao
  let projetoId: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    admin = await t.sessaoDe('Administrador')
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    outroDev = await t.sessaoDe('Desenvolvedor')
    projetoId = (await criarProjetoApi(t, analista.cookie, analista.usuario.id)).id
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  async function transicionar(
    s: Sessao,
    a: { id: string; versao: number },
    destino: string,
    justificativa?: string,
  ) {
    return t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: s.cookie,
      corpo: { destino, justificativa, versao: a.versao },
    })
  }

  async function atribuir(
    s: Sessao,
    a: { id: string; versao: number },
    responsavelId: string | null,
  ) {
    return t.requisitar(`/api/achados/${a.id}/responsavel`, {
      metodo: 'PUT',
      cookie: s.cookie,
      corpo: { responsavelId, versao: a.versao },
    })
  }

  async function ok(res: Response): Promise<AchadoResposta> {
    if (res.status !== 200) throw new Error(`${res.status} ${await res.text()}`)
    return (await res.json()) as AchadoResposta
  }

  it('fluxo completo: atribuir, iniciar, concluir, aprovar, reabrir', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId)
    a = await ok(await atribuir(analista, a, dev.usuario.id))
    expect(a.responsavel?.id).toBe(dev.usuario.id)
    a = await ok(await transicionar(analista, a, 'EmCorrecao'))
    expect(a.status).toBe('EmCorrecao')

    // Desenvolvedor responsável vê e executa apenas "Concluir correção".
    const visao = (await (
      await t.requisitar(`/api/achados/${a.id}`, { cookie: dev.cookie })
    ).json()) as AchadoResposta
    expect(visao.acoes.transicoes.map((x) => x.destino)).toEqual(['AguardandoVerificacao'])
    a = await ok(await transicionar(dev, a, 'AguardandoVerificacao'))

    a = await ok(await transicionar(analista, a, 'Corrigido'))
    expect(a.status).toBe('Corrigido')
    expect(a.encerradoEm).not.toBeNull()

    a = await ok(await transicionar(analista, a, 'Aberto', 'Regressão na versão 2.1'))
    expect(a.status).toBe('Aberto')
    expect(a.encerradoEm).toBeNull()

    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
      .orderBy(asc(eventosHistorico.ocorridoEm))
    expect(eventos.map((e) => `${e.tipo}:${e.valorNovo ?? ''}`)).toEqual([
      `Criacao:${a.codigo}`,
      `TrocaResponsavel:${dev.usuario.nome}`,
      'Transicao:EmCorrecao',
      'Transicao:AguardandoVerificacao',
      'Transicao:Corrigido',
      'Transicao:Aberto',
    ])
    expect(eventos.find((e) => e.valorNovo === 'AguardandoVerificacao')?.autorId).toBe(
      dev.usuario.id,
    )
    expect(eventos.at(-1)?.justificativa).toBe('Regressão na versão 2.1')
  })

  it('desenvolvedor só conclui correção de achado atribuído a ele (403)', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    a = await ok(await transicionar(analista, a, 'EmCorrecao'))
    const res = await transicionar(outroDev, a, 'AguardandoVerificacao')
    expect(res.status).toBe(403)
    expect((await transicionar(dev, a, 'AguardandoVerificacao')).status).toBe(200)
  })

  it('desenvolvedor recebe 403 em transições reservadas ao analista', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    expect((await transicionar(dev, a, 'EmCorrecao')).status).toBe(403)
    expect((await transicionar(dev, a, 'FalsoPositivo', 'x')).status).toBe(403)
  })

  it('aceitar risco é exclusivo do administrador', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    expect(
      (await transicionar(analista, a, 'RiscoAceito', 'Sistema será desativado.')).status,
    ).toBe(403)
    const r = await ok(await transicionar(admin, a, 'RiscoAceito', 'Sistema será desativado.'))
    expect(r.status).toBe('RiscoAceito')
  })

  it('transição inexistente retorna 409', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    expect((await transicionar(admin, a, 'Corrigido')).status).toBe(409)
    expect((await transicionar(admin, a, 'Aberto')).status).toBe(409)
  })

  it('RN03: iniciar correção sem responsável retorna 409', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    expect((await transicionar(analista, a, 'EmCorrecao')).status).toBe(409)
  })

  it('RF17: falso positivo sem justificativa retorna 400', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    const res = await transicionar(analista, a, 'FalsoPositivo', '   ')
    expect(res.status).toBe(400)
    const corpo = (await res.json()) as { errors: { campo: string }[] }
    expect(corpo.errors[0]!.campo).toBe('justificativa')
  })

  it('duas transições com a mesma versão: a segunda recebe 409', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    a = await ok(await transicionar(analista, a, 'EmCorrecao'))
    const primeira = await transicionar(dev, a, 'AguardandoVerificacao')
    const segunda = await transicionar(analista, a, 'Aberto')
    expect(primeira.status).toBe(200)
    expect(segunda.status).toBe(409)
  })

  it('transições simultâneas com a mesma versão: só uma é aplicada', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    const respostas = await Promise.all([
      transicionar(analista, a, 'FalsoPositivo', 'a'),
      transicionar(admin, a, 'RiscoAceito', 'b'),
      transicionar(admin, a, 'FalsoPositivo', 'c'),
    ])
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409])
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
    expect(eventos.filter((e) => e.tipo === 'Transicao')).toHaveLength(1)
  })

  it('remover responsável de achado em correção devolve a Aberto com dois eventos', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    a = await ok(await transicionar(analista, a, 'EmCorrecao'))
    a = await ok(await atribuir(analista, a, null))
    expect(a).toMatchObject({ status: 'Aberto', responsavel: null })
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
    expect(eventos.filter((e) => e.tipo === 'Transicao').at(-1)).toMatchObject({
      valorAnterior: 'EmCorrecao',
      valorNovo: 'Aberto',
    })
  })

  it('atribuição: só usuários ativos; desenvolvedor recebe 403; versão divergente 409', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    const inativo = await t.criarUsuario('Desenvolvedor', { ativo: false })
    expect((await atribuir(analista, a, inativo.id)).status).toBe(400)
    expect((await atribuir(analista, a, '00000000-0000-4000-8000-000000000000')).status).toBe(400)
    expect((await atribuir(dev, a, dev.usuario.id)).status).toBe(403)
    expect((await atribuir(analista, { ...a, versao: 99 }, dev.usuario.id)).status).toBe(409)
    const r = await ok(await atribuir(analista, a, dev.usuario.id))
    expect(r.versao).toBe(2)
    // Mesma atribuição não gera evento nem nova versão.
    const igual = await ok(await atribuir(analista, r, dev.usuario.id))
    expect(igual.versao).toBe(2)
  })

  it('achado encerrado não aceita atribuição (409)', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId)
    a = await ok(await transicionar(analista, a, 'FalsoPositivo', 'duplicado'))
    expect((await atribuir(analista, a, dev.usuario.id)).status).toBe(409)
  })

  it('achado de projeto arquivado não aceita transição (409) nem exibe ações', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    let a = await criarAchadoApi(t, analista.cookie, p.id)
    a = await ok(await transicionar(analista, a, 'FalsoPositivo', 'teste'))
    await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
      metodo: 'POST',
      cookie: analista.cookie,
    })
    expect((await transicionar(analista, a, 'Aberto', 'reabrir')).status).toBe(409)
    const visao = (await (
      await t.requisitar(`/api/achados/${a.id}`, { cookie: analista.cookie })
    ).json()) as AchadoResposta
    expect(visao.acoes.transicoes).toEqual([])
  })

  it('destino inválido ou campos extras retornam 400', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    expect((await transicionar(analista, a, 'Fechado')).status).toBe(400)
    const extra = await t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { destino: 'FalsoPositivo', justificativa: 'x', versao: 1, encerradoEm: '2020-01-01' },
    })
    expect(extra.status).toBe(400)
  })
})
