import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { sessoes, usuarios } from '../../src/db/schema.js'
import { hashToken } from '../../src/infra/token.js'
import {
  criarAmbienteTeste,
  extrairCookie,
  SENHA_PADRAO,
  type AmbienteTeste,
} from '../apoio/app-teste.js'

describe('autenticação por sessão', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('entra, envia cookie seguro e grava apenas o hash do token', async () => {
    const u = await t.criarUsuario('Analista', { email: 'Ana@Teste.Local' })
    const res = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: 'ana@teste.local', senha: SENHA_PADRAO },
    })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/^__Host-vulncase_sessao=/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=28800')

    const token = extrairCookie(res).split('=')[1]!
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    const linhas = await t.db.select().from(sessoes).where(eq(sessoes.usuarioId, u.id))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.tokenHash).toBe(hashToken(token))
    // Nenhum token em claro no banco.
    const todas = await t.db.select().from(sessoes)
    expect(todas.some((s) => s.tokenHash === token)).toBe(false)
    const corpo = (await res.json()) as { usuario: { id: string; papel: string } }
    expect(corpo.usuario).toMatchObject({ id: u.id, papel: 'Analista' })
    expect(JSON.stringify(corpo)).not.toContain('passwordHash')
  })

  it('GET /api/auth/me retorna o usuário atual', async () => {
    const { usuario, cookie } = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar('/api/auth/me', { cookie })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: 'Desenvolvedor' },
    })
  })

  it('emite novo token a cada entrada', async () => {
    const u = await t.criarUsuario('Analista')
    const c1 = await t.entrar(u.email)
    const c2 = await t.entrar(u.email)
    expect(c1).not.toBe(c2)
  })

  it('mesma resposta para usuário inexistente e senha errada', async () => {
    const u = await t.criarUsuario('Analista')
    const r1 = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: 'nao-existe@teste.local', senha: 'qualquer-coisa' },
    })
    const r2 = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: u.email, senha: 'senha-errada-xyz' },
    })
    expect(r1.status).toBe(401)
    expect(r2.status).toBe(401)
    const b1 = (await r1.json()) as Record<string, unknown>
    const b2 = (await r2.json()) as Record<string, unknown>
    expect(b1.title).toBe(b2.title)
    expect(b1.detail).toBe(b2.detail)
  })

  it('usuário inativo não entra, mesmo com a senha correta', async () => {
    const u = await t.criarUsuario('Analista', { ativo: false })
    const res = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: u.email, senha: SENHA_PADRAO },
    })
    expect(res.status).toBe(401)
  })

  it('bloqueia após 5 falhas: a sexta tentativa retorna 429 mesmo com a senha correta', async () => {
    const u = await t.criarUsuario('Analista')
    for (let i = 0; i < 5; i++) {
      const r = await t.requisitar('/api/auth/login', {
        metodo: 'POST',
        corpo: { email: u.email, senha: `errada-${i}-xxxxx` },
      })
      expect(r.status).toBe(401)
    }
    const sexta = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: u.email, senha: SENHA_PADRAO },
    })
    expect(sexta.status).toBe(429)
    const [linha] = await t.db.select().from(usuarios).where(eq(usuarios.id, u.id))
    const restanteMin = (linha!.bloqueadoAte!.getTime() - Date.now()) / 60_000
    expect(restanteMin).toBeGreaterThan(14)
    expect(restanteMin).toBeLessThanOrEqual(15)
    expect(
      t.linhas().some((l) => l.evento === 'auth.conta_bloqueada' && l.usuarioId === u.id),
    ).toBe(true)
  })

  it('bloqueio expirado libera a entrada e zera o contador', async () => {
    const u = await t.criarUsuario('Analista')
    await t.db
      .update(usuarios)
      .set({ bloqueadoAte: new Date(Date.now() - 1000), tentativasFalhas: 3 })
      .where(eq(usuarios.id, u.id))
    await t.entrar(u.email)
    const [linha] = await t.db.select().from(usuarios).where(eq(usuarios.id, u.id))
    expect(linha!.tentativasFalhas).toBe(0)
    expect(linha!.bloqueadoAte).toBeNull()
  })

  it('sessão expirada retorna 401', async () => {
    const { usuario, cookie } = await t.sessaoDe('Analista')
    await t.db
      .update(sessoes)
      .set({ expiraEm: new Date(Date.now() - 1000) })
      .where(eq(sessoes.usuarioId, usuario.id))
    const res = await t.requisitar('/api/auth/me', { cookie })
    expect(res.status).toBe(401)
  })

  it('saída apaga a sessão e o cookie deixa de valer', async () => {
    const { usuario, cookie } = await t.sessaoDe('Analista')
    const res = await t.requisitar('/api/auth/logout', { metodo: 'POST', cookie })
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    const restantes = await t.db.select().from(sessoes).where(eq(sessoes.usuarioId, usuario.id))
    expect(restantes).toHaveLength(0)
    expect((await t.requisitar('/api/auth/me', { cookie })).status).toBe(401)
  })

  it('cookie forjado retorna 401', async () => {
    const res = await t.requisitar('/api/auth/me', {
      cookie: '__Host-vulncase_sessao=' + Buffer.alloc(32).toString('base64url'),
    })
    expect(res.status).toBe(401)
  })

  it('registra sucesso e falha de entrada no log sem a senha', async () => {
    const u = await t.criarUsuario('Analista')
    await t.entrar(u.email)
    const eventos = t.linhas().filter((l) => typeof l.evento === 'string')
    expect(eventos.some((l) => l.evento === 'auth.login_sucesso' && l.usuarioId === u.id)).toBe(
      true,
    )
    expect(eventos.some((l) => l.evento === 'auth.login_falha')).toBe(true)
    expect(JSON.stringify(t.linhas())).not.toContain(SENHA_PADRAO)
  })

  it('recusa corpo de login com campos extras', async () => {
    const res = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: 'a@b.com', senha: 'x', papel: 'Administrador' },
    })
    expect(res.status).toBe(400)
  })
})
