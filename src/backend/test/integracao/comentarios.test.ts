import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { comentarios } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { criarAchadoApi, criarProjetoApi } from '../apoio/fabricas.js'

type Sessao = Awaited<ReturnType<AmbienteTeste['sessaoDe']>>

describe('comentários', () => {
  let t: AmbienteTeste
  let analista: Sessao
  let dev: Sessao
  let outroDev: Sessao
  let projetoId: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    outroDev = await t.sessaoDe('Desenvolvedor')
    projetoId = (await criarProjetoApi(t, analista.cookie, analista.usuario.id)).id
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  const comentar = (s: Sessao, id: string, texto: unknown) =>
    t.requisitar(`/api/achados/${id}/comentarios`, {
      metodo: 'POST',
      cookie: s.cookie,
      corpo: { texto },
    })

  it('comentário aparece no histórico com autor, data e texto literal', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    const texto = 'Corrigido em <b>main</b>; <script>alert(1)</script> era o payload.'
    const res = await comentar(dev, a.id, `  ${texto}  `)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ texto, autor: { id: dev.usuario.id } })
    const { itens } = (await (
      await t.requisitar(`/api/achados/${a.id}/historico`, { cookie: analista.cookie })
    ).json()) as {
      itens: { tipo: string; valorNovo: string; autor: { nome: string }; ocorridoEm: string }[]
    }
    const ev = itens.find((e) => e.tipo === 'Comentario')
    expect(ev).toMatchObject({ valorNovo: texto, autor: { nome: dev.usuario.nome } })
    expect(Date.parse(ev!.ocorridoEm)).not.toBeNaN()
    expect(
      await t.db.select().from(comentarios).where(eq(comentarios.achadoId, a.id)),
    ).toHaveLength(1)
  })

  it('desenvolvedor só comenta nos achados atribuídos a si', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    expect((await comentar(outroDev, a.id, 'x')).status).toBe(403)
    expect((await comentar(analista, a.id, 'Analista pode.')).status).toBe(201)
  })

  it('texto vazio, longo ou com campos extras retorna 400', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    expect((await comentar(analista, a.id, '   ')).status).toBe(400)
    expect((await comentar(analista, a.id, 'x'.repeat(4001))).status).toBe(400)
    const extra = await t.requisitar(`/api/achados/${a.id}/comentarios`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { texto: 'ok', autorId: dev.usuario.id },
    })
    expect(extra.status).toBe(400)
  })

  it('achado encerrado não aceita comentário (409)', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    await t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { destino: 'FalsoPositivo', justificativa: 'duplicado', versao: 1 },
    })
    expect((await comentar(analista, a.id, 'depois')).status).toBe(409)
  })
})
