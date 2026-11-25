import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { eventosHistorico } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import {
  achadoValido,
  criarAchadoApi,
  criarProjetoApi,
  type AchadoResposta,
} from '../apoio/fabricas.js'

interface Evento {
  tipo: string
  campo: string | null
  valorAnterior: string | null
  valorNovo: string | null
  justificativa: string | null
  ocorridoEm: string
  autor: { id: string; nome: string }
}

describe('histórico do achado', () => {
  let t: AmbienteTeste
  let analista: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let dev: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let projetoId: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    projetoId = (await criarProjetoApi(t, analista.cookie, analista.usuario.id)).id
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  async function post(s: { cookie: string }, url: string, corpo: unknown, metodo = 'POST') {
    const res = await t.requisitar(url, { metodo, cookie: s.cookie, corpo })
    if (res.status !== 200) throw new Error(`${url}: ${res.status} ${await res.text()}`)
    return (await res.json()) as AchadoResposta
  }

  it('um evento para cada criação, edição, troca de responsável e transição, com autor e justificativa', async () => {
    let a = await criarAchadoApi(t, analista.cookie, projetoId)
    a = await post(
      analista,
      `/api/achados/${a.id}`,
      achadoValido({ severidade: 'Critica', versao: a.versao }),
      'PUT',
    )
    a = await post(
      analista,
      `/api/achados/${a.id}/responsavel`,
      { responsavelId: dev.usuario.id, versao: a.versao },
      'PUT',
    )
    a = await post(analista, `/api/achados/${a.id}/transicoes`, {
      destino: 'EmCorrecao',
      versao: a.versao,
    })
    a = await post(dev, `/api/achados/${a.id}/transicoes`, {
      destino: 'AguardandoVerificacao',
      versao: a.versao,
    })
    a = await post(analista, `/api/achados/${a.id}/transicoes`, {
      destino: 'EmCorrecao',
      justificativa: 'O parâmetro ainda é concatenado na consulta.',
      versao: a.versao,
    })
    a = await post(dev, `/api/achados/${a.id}/transicoes`, {
      destino: 'AguardandoVerificacao',
      versao: a.versao,
    })
    a = await post(analista, `/api/achados/${a.id}/transicoes`, {
      destino: 'Corrigido',
      versao: a.versao,
    })

    const res = await t.requisitar(`/api/achados/${a.id}/historico`, { cookie: dev.cookie })
    expect(res.status).toBe(200)
    const { itens } = (await res.json()) as { itens: Evento[] }
    expect(itens.map((e) => [e.tipo, e.campo, e.valorAnterior, e.valorNovo, e.autor.id])).toEqual([
      ['Criacao', null, null, a.codigo, analista.usuario.id],
      ['EdicaoCampo', 'severidade', 'Alta', 'Critica', analista.usuario.id],
      ['TrocaResponsavel', 'responsavel', null, dev.usuario.nome, analista.usuario.id],
      ['Transicao', 'status', 'Aberto', 'EmCorrecao', analista.usuario.id],
      ['Transicao', 'status', 'EmCorrecao', 'AguardandoVerificacao', dev.usuario.id],
      ['Transicao', 'status', 'AguardandoVerificacao', 'EmCorrecao', analista.usuario.id],
      ['Transicao', 'status', 'EmCorrecao', 'AguardandoVerificacao', dev.usuario.id],
      ['Transicao', 'status', 'AguardandoVerificacao', 'Corrigido', analista.usuario.id],
    ])
    expect(itens[5]!.justificativa).toBe('O parâmetro ainda é concatenado na consulta.')
    expect(itens.every((e) => e.autor.nome && !Number.isNaN(Date.parse(e.ocorridoEm)))).toBe(true)
    const datas = itens.map((e) => Date.parse(e.ocorridoEm))
    expect([...datas].sort((x, y) => x - y)).toEqual(datas)
  })

  it('eventos gravados no mesmo instante mantêm a ordem de inserção', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId, { responsavelId: dev.usuario.id })
    const { itens } = (await (
      await t.requisitar(`/api/achados/${a.id}/historico`, { cookie: dev.cookie })
    ).json()) as {
      itens: Evento[]
    }
    expect(itens.map((e) => e.tipo)).toEqual(['Criacao', 'TrocaResponsavel'])
  })

  it('achado inexistente retorna 404', async () => {
    const res = await t.requisitar('/api/achados/00000000-0000-4000-8000-000000000000/historico', {
      cookie: dev.cookie,
    })
    expect(res.status).toBe(404)
  })

  it('o banco recusa UPDATE, DELETE e TRUNCATE no histórico', async () => {
    const a = await criarAchadoApi(t, analista.cookie, projetoId)
    await expect(
      t.db
        .update(eventosHistorico)
        .set({ justificativa: 'adulterado' })
        .where(eq(eventosHistorico.achadoId, a.id)),
    ).rejects.toThrow()
    await expect(
      t.db.delete(eventosHistorico).where(eq(eventosHistorico.achadoId, a.id)),
    ).rejects.toThrow()
    await expect(t.db.execute(sql`TRUNCATE eventos_historico`)).rejects.toThrow()
    const restantes = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
    expect(restantes).toHaveLength(1)
  })

  it('nenhum código da aplicação altera ou exclui eventos do histórico', () => {
    const raiz = path.resolve(import.meta.dirname, '../../src')
    const arquivos: string[] = []
    const percorrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = path.join(dir, nome)
        if (statSync(caminho).isDirectory()) percorrer(caminho)
        else if (caminho.endsWith('.ts')) arquivos.push(caminho)
      }
    }
    percorrer(raiz)
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, 'utf8')
      expect(codigo, arquivo).not.toMatch(/\.(update|delete)\(\s*eventosHistorico\b/)
    }
  })
})
