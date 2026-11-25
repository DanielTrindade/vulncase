import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { achados, projetos } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'

interface Projeto {
  id: string
  prefixo: string
  arquivado: boolean
  prefixoEditavel: boolean
  totalAbertos: number
  abertosPorSeveridade: Record<string, number>
  responsavelTecnico: { id: string; nome: string }
}

describe('API de projetos', () => {
  let t: AmbienteTeste
  let analista: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let dev: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  const novo = (prefixo: string) => ({
    prefixo,
    nome: `Projeto ${prefixo}`,
    descricao: 'Escopo do laboratório',
    responsavelTecnicoId: analista.usuario.id,
  })

  async function criar(prefixo: string): Promise<Projeto> {
    const res = await t.requisitar('/api/projetos', {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: novo(prefixo),
    })
    expect(res.status).toBe(201)
    return (await res.json()) as Projeto
  }

  async function inserirAchado(
    projetoId: string,
    codigo: string,
    status: 'Aberto' | 'Corrigido',
    severidade: 'Critica' | 'Alta' = 'Alta',
  ) {
    await t.db.insert(achados).values({
      projetoId,
      codigo,
      titulo: 'T',
      descricao: 'D',
      origem: 'Outra',
      severidade,
      status,
      localizacao: 'L',
      correcaoProposta: 'C',
      registradoPorId: analista.usuario.id,
      encerradoEm: status === 'Corrigido' ? new Date() : null,
    })
  }

  it('analista cria projeto; prefixo é normalizado para maiúsculas', async () => {
    const p = await criar('web')
    expect(p).toMatchObject({
      prefixo: 'WEB',
      arquivado: false,
      prefixoEditavel: true,
      totalAbertos: 0,
    })
    expect(p.responsavelTecnico.id).toBe(analista.usuario.id)
  })

  it('desenvolvedor recebe 403 ao criar, editar ou arquivar projeto', async () => {
    const p = await criar('DEVX')
    expect(
      (
        await t.requisitar('/api/projetos', {
          metodo: 'POST',
          cookie: dev.cookie,
          corpo: novo('NOPE'),
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await t.requisitar(`/api/projetos/${p.id}`, {
          metodo: 'PUT',
          cookie: dev.cookie,
          corpo: novo('DEVX'),
        })
      ).status,
    ).toBe(403)
    expect(
      (await t.requisitar(`/api/projetos/${p.id}/arquivar`, { metodo: 'POST', cookie: dev.cookie }))
        .status,
    ).toBe(403)
  })

  it('desenvolvedor consulta a lista e o detalhe', async () => {
    const p = await criar('CONS')
    expect((await t.requisitar('/api/projetos', { cookie: dev.cookie })).status).toBe(200)
    expect((await t.requisitar(`/api/projetos/${p.id}`, { cookie: dev.cookie })).status).toBe(200)
  })

  it('prefixo duplicado retorna 409', async () => {
    await criar('DUP')
    const res = await t.requisitar('/api/projetos', {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: novo('dup'),
    })
    expect(res.status).toBe(409)
  })

  it.each(['A', 'ABCDEF', 'AB1', 'A-B'])('prefixo inválido %s retorna 400', async (prefixo) => {
    const res = await t.requisitar('/api/projetos', {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: novo(prefixo),
    })
    expect(res.status).toBe(400)
  })

  it('responsável técnico inativo ou inexistente retorna 400', async () => {
    const inativo = await t.criarUsuario('Analista', { ativo: false })
    const res = await t.requisitar('/api/projetos', {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { ...novo('INAT'), responsavelTecnicoId: inativo.id },
    })
    expect(res.status).toBe(400)
  })

  it('edita projeto e permite trocar o prefixo enquanto não há achados', async () => {
    const p = await criar('EDT')
    const res = await t.requisitar(`/api/projetos/${p.id}`, {
      metodo: 'PUT',
      cookie: analista.cookie,
      corpo: { ...novo('EDTB'), nome: 'Novo nome', descricao: '' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ prefixo: 'EDTB', nome: 'Novo nome', descricao: null })
  })

  it('prefixo é imutável após o primeiro achado', async () => {
    const p = await criar('IMU')
    await inserirAchado(p.id, 'IMU-0001', 'Aberto')
    await t.db.update(projetos).set({ proximoNumeroAchado: 2 }).where(eq(projetos.id, p.id))
    const res = await t.requisitar(`/api/projetos/${p.id}`, {
      metodo: 'PUT',
      cookie: analista.cookie,
      corpo: novo('IMUB'),
    })
    expect(res.status).toBe(409)
    const mesmo = await t.requisitar(`/api/projetos/${p.id}`, {
      metodo: 'PUT',
      cookie: analista.cookie,
      corpo: { ...novo('IMU'), nome: 'Renomeado' },
    })
    expect(mesmo.status).toBe(200)
    expect(((await mesmo.json()) as Projeto).prefixoEditavel).toBe(false)
  })

  it('lista com contagem de achados abertos por severidade', async () => {
    const p = await criar('CNT')
    await inserirAchado(p.id, 'CNT-0001', 'Aberto', 'Critica')
    await inserirAchado(p.id, 'CNT-0002', 'Aberto', 'Alta')
    await inserirAchado(p.id, 'CNT-0003', 'Aberto', 'Alta')
    await inserirAchado(p.id, 'CNT-0004', 'Corrigido', 'Alta')
    const res = await t.requisitar('/api/projetos', { cookie: analista.cookie })
    const { itens } = (await res.json()) as { itens: Projeto[] }
    const item = itens.find((i) => i.id === p.id)!
    expect(item.abertosPorSeveridade).toEqual({
      Critica: 1,
      Alta: 2,
      Media: 0,
      Baixa: 0,
      Informativa: 0,
    })
    expect(item.totalAbertos).toBe(3)
  })

  it('RN08: não arquiva com achados não encerrados (409); arquiva após encerrar', async () => {
    const p = await criar('ARQ')
    await inserirAchado(p.id, 'ARQ-0001', 'Aberto')
    const r1 = await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
      metodo: 'POST',
      cookie: analista.cookie,
    })
    expect(r1.status).toBe(409)

    await t.db
      .update(achados)
      .set({ status: 'Corrigido', encerradoEm: new Date() })
      .where(eq(achados.codigo, 'ARQ-0001'))
    const r2 = await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
      metodo: 'POST',
      cookie: analista.cookie,
    })
    expect(r2.status).toBe(200)
    expect(((await r2.json()) as Projeto).arquivado).toBe(true)

    // Oculto da listagem padrão e visível com o filtro.
    const padrao = (await (
      await t.requisitar('/api/projetos', { cookie: analista.cookie })
    ).json()) as { itens: Projeto[] }
    expect(padrao.itens.some((i) => i.id === p.id)).toBe(false)
    const arq = (await (
      await t.requisitar('/api/projetos?arquivados=true', { cookie: analista.cookie })
    ).json()) as {
      itens: Projeto[]
    }
    expect(arq.itens.some((i) => i.id === p.id)).toBe(true)

    // Arquivado não é editado nem arquivado de novo.
    expect(
      (
        await t.requisitar(`/api/projetos/${p.id}`, {
          metodo: 'PUT',
          cookie: analista.cookie,
          corpo: novo('ARQ'),
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await t.requisitar(`/api/projetos/${p.id}/arquivar`, {
          metodo: 'POST',
          cookie: analista.cookie,
        })
      ).status,
    ).toBe(409)
  })

  it('projeto inexistente retorna 404; filtro inválido retorna 400', async () => {
    expect(
      (
        await t.requisitar('/api/projetos/00000000-0000-4000-8000-000000000000', {
          cookie: dev.cookie,
        })
      ).status,
    ).toBe(404)
    expect(
      (await t.requisitar('/api/projetos?arquivados=talvez', { cookie: dev.cookie })).status,
    ).toBe(400)
  })

  it('recusa campos extras (mass assignment)', async () => {
    const res = await t.requisitar('/api/projetos', {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { ...novo('MASS'), arquivado: true, proximoNumeroAchado: 99 },
    })
    expect(res.status).toBe(400)
  })
})
