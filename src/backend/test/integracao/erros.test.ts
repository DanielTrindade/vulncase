import { describe, expect, it } from 'vitest'
import { criarAppSemBanco } from '../apoio/app-sem-banco.js'

function montar() {
  const { app, linhas } = criarAppSemBanco()
  app.get('/api/explodir', () => {
    throw new Error('SELECT * FROM segredo -- /srv/app/arquivo.ts:42')
  })
  return { app, linhas }
}

describe('tratamento de erros', () => {
  it('GET /api/health responde 200', async () => {
    const { app } = montar()
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('erro não tratado retorna 500 genérico e é registrado com requestId', async () => {
    const { app, linhas } = montar()
    const res = await app.request('/api/explodir')
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const texto = await res.text()
    expect(texto).not.toContain('SELECT')
    expect(texto).not.toContain('arquivo.ts')
    const corpo = JSON.parse(texto) as { title: string; requestId: string }
    expect(corpo.title).toBe('Erro interno')

    const registro = linhas().find((l) => l.msg === 'erro não tratado')
    expect(registro).toBeDefined()
    expect(registro?.requestId).toBe(corpo.requestId)
    expect(JSON.stringify(registro)).toContain('SELECT')
  })

  it('rota inexistente retorna 404 Problem Details', async () => {
    const { app } = montar()
    const res = await app.request('/api/nao-existe')
    expect(res.status).toBe(404)
    expect(((await res.json()) as { status: number }).status).toBe(404)
  })
})
