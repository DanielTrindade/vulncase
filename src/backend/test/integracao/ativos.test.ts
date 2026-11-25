import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { achados } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import {
  achadoValido,
  criarAchadoApi,
  criarProjetoApi,
  type AchadoResposta,
} from '../apoio/fabricas.js'

type Sessao = Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
const ativoValido = (extra: Record<string, unknown> = {}) => ({
  nome: 'Juice Shop',
  tipo: 'AplicacaoWeb',
  identificador: 'http://localhost:3001',
  ambiente: 'Laboratorio',
  ...extra,
})

describe('ativos do projeto', () => {
  let t: AmbienteTeste
  let analista: Sessao
  let dev: Sessao

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  async function novoAtivo(projetoId: string, extra: Record<string, unknown> = {}) {
    const res = await t.requisitar(`/api/projetos/${projetoId}/ativos`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: ativoValido(extra),
    })
    expect(res.status).toBe(201)
    return (await res.json()) as { id: string; nome: string }
  }

  it('analista cadastra e todos listam; desenvolvedor não cadastra', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    const a = await novoAtivo(p.id)
    expect(a).toMatchObject({ nome: 'Juice Shop', tipo: 'AplicacaoWeb', ambiente: 'Laboratorio' })
    const lista = (await (
      await t.requisitar(`/api/projetos/${p.id}/ativos`, { cookie: dev.cookie })
    ).json()) as {
      itens: { id: string }[]
    }
    expect(lista.itens.map((i) => i.id)).toEqual([a.id])
    const negado = await t.requisitar(`/api/projetos/${p.id}/ativos`, {
      metodo: 'POST',
      cookie: dev.cookie,
      corpo: ativoValido({ nome: 'X' }),
    })
    expect(negado.status).toBe(403)
  })

  it('nome duplicado no projeto retorna 409; tipo inválido retorna 400', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    await novoAtivo(p.id)
    const dup = await t.requisitar(`/api/projetos/${p.id}/ativos`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: ativoValido(),
    })
    expect(dup.status).toBe(409)
    const inv = await t.requisitar(`/api/projetos/${p.id}/ativos`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: ativoValido({ tipo: 'Mainframe' }),
    })
    expect(inv.status).toBe(400)
  })

  it('vincula achado a ativo do mesmo projeto, exibe no detalhe e filtra na lista', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    const ativo = await novoAtivo(p.id)
    const outro = await novoAtivo(p.id, { nome: 'API REST', tipo: 'Api', identificador: '/api' })
    const a = await criarAchadoApi(t, analista.cookie, p.id, { ativoId: ativo.id })
    expect(a.ativo).toMatchObject({ id: ativo.id, nome: 'Juice Shop' })
    await criarAchadoApi(t, analista.cookie, p.id)
    const lista = (await (
      await t.requisitar(`/api/achados?projetoId=${p.id}&ativoId=${ativo.id}`, {
        cookie: dev.cookie,
      })
    ).json()) as {
      total: number
    }
    expect(lista.total).toBe(1)

    const res = await t.requisitar(`/api/achados/${a.id}`, {
      metodo: 'PUT',
      cookie: analista.cookie,
      corpo: achadoValido({ ativoId: outro.id, versao: a.versao }),
    })
    const editado = (await res.json()) as AchadoResposta
    expect(editado.ativo).toMatchObject({ nome: 'API REST' })
    const { itens } = (await (
      await t.requisitar(`/api/achados/${a.id}/historico`, { cookie: dev.cookie })
    ).json()) as {
      itens: { campo: string; valorAnterior: string; valorNovo: string }[]
    }
    expect(itens.find((e) => e.campo === 'ativo')).toMatchObject({
      valorAnterior: 'Juice Shop',
      valorNovo: 'API REST',
    })
  })

  it('achado não pode ser vinculado a ativo de outro projeto (400) nem pelo banco', async () => {
    const p1 = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    const p2 = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    const ativoP2 = await novoAtivo(p2.id)
    const res = await t.requisitar(`/api/projetos/${p1.id}/achados`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: achadoValido({ ativoId: ativoP2.id }),
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { errors: { campo: string }[] }).errors[0]!.campo).toBe('ativoId')

    const a = await criarAchadoApi(t, analista.cookie, p1.id)
    const edicao = await t.requisitar(`/api/achados/${a.id}`, {
      metodo: 'PUT',
      cookie: analista.cookie,
      corpo: achadoValido({ ativoId: ativoP2.id, versao: a.versao }),
    })
    expect(edicao.status).toBe(400)
    // A chave estrangeira composta recusa mesmo uma gravação direta.
    await expect(
      t.db.update(achados).set({ ativoId: ativoP2.id }).where(eq(achados.id, a.id)),
    ).rejects.toThrow()
  })

  it('projeto arquivado não aceita novos ativos (409)', async () => {
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
      metodo: 'POST',
      cookie: analista.cookie,
    })
    const res = await t.requisitar(`/api/projetos/${p.id}/ativos`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: ativoValido(),
    })
    expect(res.status).toBe(409)
  })
})
