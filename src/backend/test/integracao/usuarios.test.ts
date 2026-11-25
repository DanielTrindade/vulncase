import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { achados, eventosHistorico, projetos, sessoes, usuarios } from '../../src/db/schema.js'
import { criarAmbienteTeste, SENHA_PADRAO, type AmbienteTeste } from '../apoio/app-teste.js'

describe('API de usuários', () => {
  let t: AmbienteTeste
  let admin: Awaited<ReturnType<AmbienteTeste['sessaoDe']>>

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    admin = await t.sessaoDe('Administrador')
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('administrador cadastra usuário e ele consegue entrar', async () => {
    const res = await t.requisitar('/api/usuarios', {
      metodo: 'POST',
      cookie: admin.cookie,
      corpo: {
        nome: 'Dev Novo',
        email: 'Dev.Novo@Teste.local',
        papel: 'Desenvolvedor',
        senha: 'senha-inicial-1',
      },
    })
    expect(res.status).toBe(201)
    const corpo = (await res.json()) as Record<string, unknown>
    expect(corpo).toMatchObject({
      email: 'dev.novo@teste.local',
      papel: 'Desenvolvedor',
      ativo: true,
    })
    expect(corpo).not.toHaveProperty('passwordHash')
    expect(res.headers.get('location')).toBe(`/api/usuarios/${String(corpo.id)}`)
    await t.entrar('dev.novo@teste.local', 'senha-inicial-1')
    expect(t.linhas().some((l) => l.evento === 'admin.usuario_criado')).toBe(true)
  })

  it('e-mail duplicado (sem diferenciar maiúsculas) retorna 409', async () => {
    const res = await t.requisitar('/api/usuarios', {
      metodo: 'POST',
      cookie: admin.cookie,
      corpo: {
        nome: 'Outro',
        email: 'DEV.NOVO@teste.local',
        papel: 'Analista',
        senha: 'senha-inicial-1',
      },
    })
    expect(res.status).toBe(409)
  })

  it('senha com menos de 10 caracteres retorna 400 com o campo', async () => {
    const res = await t.requisitar('/api/usuarios', {
      metodo: 'POST',
      cookie: admin.cookie,
      corpo: { nome: 'X', email: 'x@teste.local', papel: 'Analista', senha: 'curta' },
    })
    expect(res.status).toBe(400)
    const corpo = (await res.json()) as { errors: { campo: string }[] }
    expect(corpo.errors.map((e) => e.campo)).toContain('senha')
  })

  it('recusa campos extras no cadastro (mass assignment)', async () => {
    const res = await t.requisitar('/api/usuarios', {
      metodo: 'POST',
      cookie: admin.cookie,
      corpo: {
        nome: 'X',
        email: 'y@teste.local',
        papel: 'Analista',
        senha: 'senha-longa-1',
        ativo: false,
        tentativasFalhas: 0,
      },
    })
    expect(res.status).toBe(400)
  })

  it('lista usuários sem expor hash', async () => {
    const res = await t.requisitar('/api/usuarios', { cookie: admin.cookie })
    expect(res.status).toBe(200)
    const texto = await res.text()
    expect(texto).not.toContain('argon2')
    expect((JSON.parse(texto) as { itens: unknown[] }).itens.length).toBeGreaterThan(0)
  })

  it.each(['Analista', 'Desenvolvedor'] as const)(
    '%s recebe 403 nas rotas de administração',
    async (papel) => {
      const { cookie } = await t.sessaoDe(papel)
      expect((await t.requisitar('/api/usuarios', { cookie })).status).toBe(403)
      expect(
        (
          await t.requisitar('/api/usuarios', {
            metodo: 'POST',
            cookie,
            corpo: {
              nome: 'X',
              email: 'z@teste.local',
              papel: 'Administrador',
              senha: 'senha-longa-1',
            },
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await t.requisitar(`/api/usuarios/${admin.usuario.id}`, {
            metodo: 'PATCH',
            cookie,
            corpo: { ativo: false },
          })
        ).status,
      ).toBe(403)
    },
  )

  it('altera o papel e revoga as sessões do usuário', async () => {
    const alvo = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar(`/api/usuarios/${alvo.usuario.id}`, {
      metodo: 'PATCH',
      cookie: admin.cookie,
      corpo: { papel: 'Analista' },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { papel: string }).papel).toBe('Analista')
    expect((await t.requisitar('/api/auth/me', { cookie: alvo.cookie })).status).toBe(401)
    expect(t.linhas().some((l) => l.evento === 'admin.papel_alterado')).toBe(true)
  })

  it('usuário desativado perde a sessão em andamento e não consegue entrar', async () => {
    const alvo = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar(`/api/usuarios/${alvo.usuario.id}`, {
      metodo: 'PATCH',
      cookie: admin.cookie,
      corpo: { ativo: false },
    })
    expect(res.status).toBe(200)
    expect((await t.requisitar('/api/auth/me', { cookie: alvo.cookie })).status).toBe(401)
    const restantes = await t.db
      .select()
      .from(sessoes)
      .where(eq(sessoes.usuarioId, alvo.usuario.id))
    expect(restantes).toHaveLength(0)
    const login = await t.requisitar('/api/auth/login', {
      metodo: 'POST',
      corpo: { email: alvo.usuario.email, senha: SENHA_PADRAO },
    })
    expect(login.status).toBe(401)
  })

  it('desativação aplica a RN11 aos achados atribuídos', async () => {
    const dev = await t.criarUsuario('Desenvolvedor')
    const [projeto] = await t.db
      .insert(projetos)
      .values({ prefixo: 'RNO', nome: 'P', responsavelTecnicoId: admin.usuario.id })
      .returning()
    const base = {
      projetoId: projeto!.id,
      titulo: 'T',
      descricao: 'D',
      origem: 'Outra' as const,
      severidade: 'Alta' as const,
      localizacao: 'L',
      correcaoProposta: 'C',
      registradoPorId: admin.usuario.id,
      responsavelId: dev.id,
    }
    const [emCorrecao, aguardando, corrigido] = await t.db
      .insert(achados)
      .values([
        { ...base, codigo: 'RNO-0001', status: 'EmCorrecao' },
        { ...base, codigo: 'RNO-0002', status: 'AguardandoVerificacao' },
        { ...base, codigo: 'RNO-0003', status: 'Corrigido', encerradoEm: new Date() },
      ])
      .returning()

    const res = await t.requisitar(`/api/usuarios/${dev.id}`, {
      metodo: 'PATCH',
      cookie: admin.cookie,
      corpo: { ativo: false },
    })
    expect(res.status).toBe(200)

    const obter = async (id: string) =>
      (await t.db.select().from(achados).where(eq(achados.id, id)))[0]!
    const a1 = await obter(emCorrecao!.id)
    expect(a1).toMatchObject({ responsavelId: null, status: 'Aberto', versao: 2 })
    const a2 = await obter(aguardando!.id)
    expect(a2).toMatchObject({ responsavelId: null, status: 'AguardandoVerificacao' })
    const a3 = await obter(corrigido!.id)
    expect(a3).toMatchObject({ responsavelId: dev.id, status: 'Corrigido', versao: 1 })

    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, emCorrecao!.id))
    expect(eventos.map((e) => e.tipo).sort()).toEqual(['Transicao', 'TrocaResponsavel'])
    expect(eventos.every((e) => e.autorId === admin.usuario.id)).toBe(true)

    // Desativado não aparece entre os responsáveis.
    const resp = await t.requisitar('/api/usuarios/responsaveis', { cookie: admin.cookie })
    const { itens } = (await resp.json()) as { itens: { id: string }[] }
    expect(itens.some((u) => u.id === dev.id)).toBe(false)
  })

  it('administrador não pode desativar a própria conta', async () => {
    const res = await t.requisitar(`/api/usuarios/${admin.usuario.id}`, {
      metodo: 'PATCH',
      cookie: admin.cookie,
      corpo: { ativo: false },
    })
    expect(res.status).toBe(409)
  })

  it('PATCH de usuário inexistente retorna 404 e id inválido retorna 400', async () => {
    expect(
      (
        await t.requisitar('/api/usuarios/00000000-0000-4000-8000-000000000000', {
          metodo: 'PATCH',
          cookie: admin.cookie,
          corpo: { ativo: false },
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await t.requisitar('/api/usuarios/abc', {
          metodo: 'PATCH',
          cookie: admin.cookie,
          corpo: { ativo: false },
        })
      ).status,
    ).toBe(400)
  })

  it('responsáveis: Analista acessa, Desenvolvedor recebe 403', async () => {
    const analista = await t.sessaoDe('Analista')
    const dev = await t.sessaoDe('Desenvolvedor')
    expect(
      (await t.requisitar('/api/usuarios/responsaveis', { cookie: analista.cookie })).status,
    ).toBe(200)
    expect((await t.requisitar('/api/usuarios/responsaveis', { cookie: dev.cookie })).status).toBe(
      403,
    )
  })
})

describe('troca de senha', () => {
  let t: AmbienteTeste

  beforeAll(async () => {
    t = await criarAmbienteTeste()
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  it('exige a senha atual e revoga as demais sessões, mantendo a atual', async () => {
    const u = await t.criarUsuario('Desenvolvedor')
    const atual = await t.entrar(u.email)
    const outra = await t.entrar(u.email)

    const errada = await t.requisitar('/api/auth/senha', {
      metodo: 'PUT',
      cookie: atual,
      corpo: { senhaAtual: 'nao-e-a-senha', novaSenha: 'nova-senha-segura' },
    })
    expect(errada.status).toBe(400)

    const ok = await t.requisitar('/api/auth/senha', {
      metodo: 'PUT',
      cookie: atual,
      corpo: { senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha-segura' },
    })
    expect(ok.status).toBe(204)
    expect((await t.requisitar('/api/auth/me', { cookie: atual })).status).toBe(200)
    expect((await t.requisitar('/api/auth/me', { cookie: outra })).status).toBe(401)
    await t.entrar(u.email, 'nova-senha-segura')
    const [linha] = await t.db.select().from(usuarios).where(eq(usuarios.id, u.id))
    expect(linha!.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('rejeita campos extras como papel no corpo', async () => {
    const { cookie } = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar('/api/auth/senha', {
      metodo: 'PUT',
      cookie,
      corpo: { senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha-segura', papel: 'Administrador' },
    })
    expect(res.status).toBe(400)
  })

  it('nova senha curta retorna 400', async () => {
    const { cookie } = await t.sessaoDe('Desenvolvedor')
    const res = await t.requisitar('/api/auth/senha', {
      metodo: 'PUT',
      cookie,
      corpo: { senhaAtual: SENHA_PADRAO, novaSenha: 'curta' },
    })
    expect(res.status).toBe(400)
  })
})
