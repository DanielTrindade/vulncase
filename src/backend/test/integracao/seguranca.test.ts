import { describe, expect, it } from 'vitest'
import { criarAppSemBanco, ORIGEM_TESTE } from '../apoio/app-sem-banco.js'

function montar() {
  const { app } = criarAppSemBanco()
  app.post('/api/eco', async (c) => c.json(await c.req.json()))
  return app
}

describe('cabeçalhos de segurança (RNF10)', () => {
  it('inclui CSP, nosniff, Referrer-Policy e X-Frame-Options: DENY', async () => {
    const res = await montar().request('/api/health')
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(csp).not.toContain('unsafe-inline')
    expect(res.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate')
  })

  it('aplica os cabeçalhos também nas respostas de erro', async () => {
    const res = await montar().request('/api/nao-existe')
    expect(res.status).toBe(401)
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })
})

describe('verificação de origem (RNF05)', () => {
  const corpo = JSON.stringify({ a: 1 })
  const json = { 'Content-Type': 'application/json' }

  it('aceita POST da origem configurada (segue para a verificação de sessão)', async () => {
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: corpo,
      headers: { ...json, Origin: ORIGEM_TESTE },
    })
    expect(res.status).toBe(401)
  })

  it('aceita POST com Sec-Fetch-Site: same-origin sem Origin', async () => {
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: corpo,
      headers: { ...json, 'Sec-Fetch-Site': 'same-origin' },
    })
    expect(res.status).toBe(401)
  })

  it('recusa POST JSON com Origin diferente (403)', async () => {
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: corpo,
      headers: { ...json, Origin: 'https://atacante.example' },
    })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { title: string }).title).toBe('Origem não permitida')
  })

  it('recusa POST de formulário com Origin diferente (403)', async () => {
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: 'a=1',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://atacante.example',
      },
    })
    expect(res.status).toBe(403)
  })

  it('recusa POST sem Origin e sem Sec-Fetch-Site (403)', async () => {
    const res = await montar().request('/api/eco', { method: 'POST', body: corpo, headers: json })
    expect(res.status).toBe(403)
  })

  it('recusa POST com Sec-Fetch-Site: cross-site (403)', async () => {
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: corpo,
      headers: { ...json, 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(res.status).toBe(403)
  })

  it('não interfere em GET', async () => {
    const res = await montar().request('/api/health', {
      headers: { Origin: 'https://atacante.example' },
    })
    expect(res.status).toBe(200)
  })
})

describe('limite de corpo', () => {
  it('corpo acima de 64 KB retorna 413', async () => {
    const grande = JSON.stringify({ texto: 'x'.repeat(65 * 1024) })
    const res = await montar().request('/api/eco', {
      method: 'POST',
      body: grande,
      headers: { 'Content-Type': 'application/json', Origin: ORIGEM_TESTE },
    })
    expect(res.status).toBe(413)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
  })
})
