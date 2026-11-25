import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { achados, projetos } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { prefixoUnico } from '../apoio/fabricas.js'

interface Item {
  id: string
  codigo: string
  titulo: string
  severidade: string
  status: string
  vencido: boolean
  dataLimite: string | null
  responsavel: { id: string; nome: string } | null
  projeto: { id: string }
}
interface Pagina {
  itens: Item[]
  total: number
  pagina: number
  tamanhoPagina: number
  totalPaginas: number
}

describe('GET /api/achados', () => {
  let t: AmbienteTeste
  let analista: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let dev: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
  let p1: string
  let arquivado: string

  const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    const novoProjeto = async (arq = false) => {
      const [p] = await t.db
        .insert(projetos)
        .values({
          prefixo: prefixoUnico(),
          nome: 'P',
          responsavelTecnicoId: analista.usuario.id,
          arquivado: arq,
        })
        .returning()
      return p!
    }
    const a = await novoProjeto()
    const b = await novoProjeto()
    const c = await novoProjeto(true)
    p1 = a.id
    arquivado = c.id
    const base = {
      descricao: 'd',
      origem: 'Outra' as const,
      localizacao: 'l',
      correcaoProposta: 'c',
      registradoPorId: analista.usuario.id,
    }
    let n = 0
    const linha = (
      projeto: { id: string; prefixo: string },
      extra: Partial<typeof achados.$inferInsert>,
    ) => ({
      ...base,
      projetoId: projeto.id,
      codigo: `${projeto.prefixo}-${String(++n).padStart(4, '0')}`,
      titulo: 'Achado',
      severidade: 'Media' as const,
      criadoEm: new Date(Date.UTC(2026, 0, 1, 0, n)),
      ...extra,
    })
    await t.db
      .insert(achados)
      .values([
        linha(a, {
          titulo: 'SQL Injection no login',
          severidade: 'Critica',
          status: 'Aberto',
          dataLimite: ontem,
        }),
        linha(a, {
          titulo: 'XSS refletido',
          severidade: 'Media',
          status: 'EmCorrecao',
          responsavelId: dev.usuario.id,
          dataLimite: amanha,
        }),
        linha(a, {
          titulo: 'Cabeçalho ausente',
          severidade: 'Baixa',
          status: 'Corrigido',
          encerradoEm: new Date(),
          dataLimite: ontem,
        }),
        linha(a, {
          titulo: 'Versão exposta 100%_real',
          severidade: 'Informativa',
          status: 'Aberto',
          categoriaOwaspId: 5,
        }),
        linha(b, {
          titulo: 'Telnet aberto',
          severidade: 'Alta',
          status: 'AguardandoVerificacao',
          responsavelId: dev.usuario.id,
        }),
        linha(b, {
          titulo: 'SMB exposto',
          severidade: 'Alta',
          status: 'FalsoPositivo',
          encerradoEm: new Date(),
        }),
        linha(c, {
          titulo: 'Do projeto arquivado',
          severidade: 'Alta',
          status: 'Corrigido',
          encerradoEm: new Date(),
        }),
      ])
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  async function listar(query: string, cookie = dev.cookie): Promise<Pagina> {
    const res = await t.requisitar(`/api/achados${query}`, { cookie })
    if (res.status !== 200) throw new Error(`${res.status} ${await res.text()}`)
    return (await res.json()) as Pagina
  }
  const titulos = (p: Pagina) => p.itens.map((i) => i.titulo)

  it('sem filtros lista achados de projetos ativos, mais recentes primeiro', async () => {
    const p = await listar('')
    expect(p.total).toBe(6)
    expect(titulos(p)[0]).toBe('SMB exposto')
    expect(titulos(p)).not.toContain('Do projeto arquivado')
    expect(p).toMatchObject({ pagina: 1, tamanhoPagina: 20, totalPaginas: 1 })
  })

  it('projeto arquivado aparece quando filtrado por projetoId', async () => {
    expect((await listar(`?projetoId=${arquivado}`)).total).toBe(1)
  })

  it('filtros combináveis: projeto, status repetível e severidade repetível', async () => {
    expect((await listar(`?projetoId=${p1}`)).total).toBe(4)
    expect(
      titulos(
        await listar(
          `?projetoId=${p1}&status=Aberto&status=EmCorrecao&severidade=Critica&severidade=Media`,
        ),
      ).sort(),
    ).toEqual(['SQL Injection no login', 'XSS refletido'])
    expect((await listar('?status=Aberto')).total).toBe(2)
  })

  it('responsável, sem responsável e categoria', async () => {
    expect(titulos(await listar(`?responsavelId=${dev.usuario.id}`)).sort()).toEqual([
      'Telnet aberto',
      'XSS refletido',
    ])
    expect((await listar('?semResponsavel=true')).total).toBe(4)
    expect((await listar('?semResponsavel=false')).total).toBe(2)
    expect(titulos(await listar('?categoriaOwaspId=5'))).toEqual(['Versão exposta 100%_real'])
  })

  it('vencido (RN09): data-limite passada e não encerrado', async () => {
    const v = await listar('?vencido=true')
    expect(titulos(v)).toEqual(['SQL Injection no login'])
    expect(v.itens[0]!.vencido).toBe(true)
    expect((await listar('?vencido=false')).total).toBe(5)
  })

  it('busca por título ou código, sem diferenciar maiúsculas', async () => {
    expect(titulos(await listar('?busca=sql%20injection'))).toEqual(['SQL Injection no login'])
    const codigo = (await listar('?busca=telnet')).itens[0]!.codigo
    expect(titulos(await listar(`?busca=${codigo.toLowerCase()}`))).toEqual(['Telnet aberto'])
  })

  it('curingas do LIKE na busca são literais', async () => {
    expect(titulos(await listar('?busca=100%25_'))).toEqual(['Versão exposta 100%_real'])
    expect((await listar('?busca=%25')).total).toBe(1)
    expect((await listar('?busca=_')).total).toBe(1)
  })

  it.each([
    "' OR 1=1 --",
    "'; DROP TABLE achados; --",
    '" OR ""="',
    "1' UNION SELECT password_hash FROM usuarios --",
  ])('tentativa de injeção na busca é tratada como texto: %s', async (busca) => {
    const p = await listar(`?busca=${encodeURIComponent(busca)}`)
    expect(p.total).toBe(0)
    expect((await listar('')).total).toBe(6)
  })

  it('ordenação por severidade e por data-limite', async () => {
    const sev = await listar(`?projetoId=${p1}&ordenarPor=severidade`)
    expect(sev.itens.map((i) => i.severidade)).toEqual(['Critica', 'Media', 'Baixa', 'Informativa'])
    const asc = await listar(`?projetoId=${p1}&ordenarPor=severidade&ordem=asc`)
    expect(asc.itens.map((i) => i.severidade)).toEqual(['Informativa', 'Baixa', 'Media', 'Critica'])
    const dl = await listar(`?projetoId=${p1}&ordenarPor=dataLimite&ordem=asc`)
    expect(dl.itens.map((i) => i.dataLimite).at(-1)).toBeNull()
  })

  it('paginação', async () => {
    const pg1 = await listar('?tamanhoPagina=4')
    const pg2 = await listar('?tamanhoPagina=4&pagina=2')
    expect(pg1.itens).toHaveLength(4)
    expect(pg2.itens).toHaveLength(2)
    expect(pg1.totalPaginas).toBe(2)
    const ids = new Set([...pg1.itens, ...pg2.itens].map((i) => i.id))
    expect(ids.size).toBe(6)
  })

  it.each([
    ['status inválido', '?status=Fechado'],
    ['severidade inválida', '?severidade=Extrema'],
    ['ordenarPor fora da lista', '?ordenarPor=password_hash'],
    ['ordenarPor com SQL', `?ordenarPor=${encodeURIComponent('criado_em; DROP TABLE achados')}`],
    ['ordem inválida', '?ordem=sideways'],
    ['tamanhoPagina acima de 100', '?tamanhoPagina=101'],
    ['tamanhoPagina zero', '?tamanhoPagina=0'],
    ['página negativa', '?pagina=-1'],
    ['projetoId não UUID', `?projetoId=${encodeURIComponent("1' OR '1'='1")}`],
    ['categoria texto', '?categoriaOwaspId=abc'],
    ['vencido inválido', '?vencido=sim'],
    ['busca longa', `?busca=${'x'.repeat(101)}`],
    ['parâmetro desconhecido', '?senha=1'],
  ])('%s retorna 400', async (_nome, query) => {
    const res = await t.requisitar(`/api/achados${query}`, { cookie: dev.cookie })
    expect(res.status).toBe(400)
  })

  it('todos os papéis consultam a lista', async () => {
    expect((await listar('', analista.cookie)).total).toBe(6)
  })
})

describe('desempenho da listagem (RNF22)', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('responde em até 1 s com 5.000 achados', async () => {
    const { usuario, cookie } = await t.sessaoDe('Analista')
    const severidades = ['Critica', 'Alta', 'Media', 'Baixa', 'Informativa'] as const
    const status = [
      'Aberto',
      'EmCorrecao',
      'AguardandoVerificacao',
      'Corrigido',
      'FalsoPositivo',
      'RiscoAceito',
    ] as const
    for (let p = 0; p < 5; p++) {
      const [proj] = await t.db
        .insert(projetos)
        .values({
          prefixo: prefixoUnico(),
          nome: `Projeto ${p}`,
          responsavelTecnicoId: usuario.id,
          proximoNumeroAchado: 1001,
        })
        .returning()
      const linhas = Array.from({ length: 1000 }, (_, i) => ({
        projetoId: proj!.id,
        codigo: `${proj!.prefixo}-${String(i + 1).padStart(4, '0')}`,
        titulo: `Achado de carga ${p}-${i}`,
        descricao: 'Descrição de carga para medir a listagem.',
        origem: 'TesteAplicacaoWeb' as const,
        severidade: severidades[i % 5]!,
        status: status[i % 6]!,
        localizacao: '/rota',
        correcaoProposta: 'Corrigir.',
        registradoPorId: usuario.id,
        dataLimite: i % 3 === 0 ? '2026-01-01' : null,
        encerradoEm: i % 6 >= 3 ? new Date() : null,
      }))
      await t.db.insert(achados).values(linhas)
    }
    await t.db.execute('ANALYZE achados')

    for (const query of [
      '?tamanhoPagina=100',
      '?ordenarPor=severidade&tamanhoPagina=100',
      '?status=Aberto&status=EmCorrecao&severidade=Critica&vencido=true',
      '?busca=carga%203-9&ordenarPor=dataLimite',
      '?pagina=50&tamanhoPagina=100',
    ]) {
      const inicio = performance.now()
      const res = await t.requisitar(`/api/achados${query}`, { cookie })
      const duracao = performance.now() - inicio
      expect(res.status).toBe(200)
      expect(duracao, query).toBeLessThan(1000)
    }
    const total = ((await (await t.requisitar('/api/achados', { cookie })).json()) as Pagina).total
    expect(total).toBe(5000)
  })
})
