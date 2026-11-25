import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { eventosHistorico } from '../../src/db/schema.js'
import { somarDias } from '../../src/dominio/prazo.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import {
  achadoValido,
  criarAchadoApi,
  criarProjetoApi,
  type AchadoResposta,
} from '../apoio/fabricas.js'

const hoje = () => new Date().toISOString().slice(0, 10)

describe('data-limite do achado (RF24)', () => {
  let t: AmbienteTeste
  let cookie: string
  let projetoId: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    const a = await t.sessaoDe('Analista')
    cookie = a.cookie
    projetoId = (await criarProjetoApi(t, cookie, a.usuario.id)).id
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  const editar = async (a: AchadoResposta, extra: Record<string, unknown>) => {
    const res = await t.requisitar(`/api/achados/${a.id}`, {
      metodo: 'PUT',
      cookie,
      corpo: achadoValido({ versao: a.versao, ...extra }),
    })
    expect(res.status).toBe(200)
    return (await res.json()) as AchadoResposta
  }

  it('achado Crítico registrado hoje vence em 7 dias', async () => {
    const a = await criarAchadoApi(t, cookie, projetoId, { severidade: 'Critica' })
    expect(a).toMatchObject({
      dataLimite: somarDias(hoje(), 7),
      dataLimiteManual: false,
      vencido: false,
    })
  })

  it('Informativa não tem prazo', async () => {
    const a = await criarAchadoApi(t, cookie, projetoId, { severidade: 'Informativa' })
    expect(a.dataLimite).toBeNull()
  })

  it('data informada no registro é ajuste manual', async () => {
    const a = await criarAchadoApi(t, cookie, projetoId, {
      severidade: 'Critica',
      dataLimite: '2030-01-31',
    })
    expect(a).toMatchObject({ dataLimite: '2030-01-31', dataLimiteManual: true })
  })

  it('mudança de severidade recalcula e registra no histórico', async () => {
    let a = await criarAchadoApi(t, cookie, projetoId, { severidade: 'Baixa' })
    expect(a.dataLimite).toBe(somarDias(hoje(), 180))
    a = await editar(a, { severidade: 'Alta' })
    expect(a.dataLimite).toBe(somarDias(hoje(), 30))
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
      .orderBy(asc(eventosHistorico.sequencia))
    expect(eventos.find((e) => e.campo === 'dataLimite')).toMatchObject({
      valorAnterior: somarDias(hoje(), 180),
      valorNovo: somarDias(hoje(), 30),
    })
  })

  it('ajuste manual não é sobrescrito pela mudança de severidade', async () => {
    let a = await criarAchadoApi(t, cookie, projetoId, { severidade: 'Media' })
    a = await editar(a, { dataLimite: '2031-03-15' })
    expect(a).toMatchObject({ dataLimite: '2031-03-15', dataLimiteManual: true })
    a = await editar(a, { severidade: 'Critica', dataLimite: '2031-03-15' })
    expect(a).toMatchObject({ dataLimite: '2031-03-15', severidade: 'Critica' })
  })

  it('data passada torna o achado vencido; vazio remove o prazo', async () => {
    let a = await criarAchadoApi(t, cookie, projetoId)
    a = await editar(a, { dataLimite: '2020-01-01' })
    expect(a.vencido).toBe(true)
    a = await editar(a, { dataLimite: '' })
    expect(a).toMatchObject({ dataLimite: null, vencido: false })
  })

  it.each(['31/12/2030', '2030-13-01', 'amanhã'])(
    'data inválida %s retorna 400',
    async (dataLimite) => {
      const res = await t.requisitar(`/api/projetos/${projetoId}/achados`, {
        metodo: 'POST',
        cookie,
        corpo: achadoValido({ dataLimite }),
      })
      expect(res.status).toBe(400)
    },
  )
})
