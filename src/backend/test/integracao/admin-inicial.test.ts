import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { criarAdministradorInicial } from '../../src/db/admin-inicial.js'
import { usuarios } from '../../src/db/schema.js'
import { criarBancoIsolado } from '../apoio/banco.js'
import { criarLogMemoria } from '../apoio/log-memoria.js'

describe('administrador inicial', () => {
  let banco: Awaited<ReturnType<typeof criarBancoIsolado>>
  const { log } = criarLogMemoria()

  beforeAll(async () => {
    banco = await criarBancoIsolado()
  })
  afterAll(async () => {
    await banco.encerrar()
  })

  it('não cria sem configuração', async () => {
    const r = await criarAdministradorInicial(banco.db, {}, log)
    expect(r).toBe('sem-configuracao')
  })

  it('cria o administrador com hash Argon2id quando o banco está vazio', async () => {
    const r = await criarAdministradorInicial(
      banco.db,
      { adminEmailInicial: 'Admin@Exemplo.com', adminSenhaInicial: 'senha-inicial-123' },
      log,
    )
    expect(r).toBe('criado')
    const [admin] = await banco.db.select().from(usuarios)
    expect(admin?.email).toBe('admin@exemplo.com')
    expect(admin?.papel).toBe('Administrador')
    expect(admin?.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('reiniciar não recria nem altera o administrador', async () => {
    const [antes] = await banco.db.select().from(usuarios)
    const r = await criarAdministradorInicial(
      banco.db,
      { adminEmailInicial: 'outro@exemplo.com', adminSenhaInicial: 'outra-senha-456' },
      log,
    )
    expect(r).toBe('existente')
    const todos = await banco.db.select().from(usuarios)
    expect(todos).toHaveLength(1)
    const [depois] = await banco.db.select().from(usuarios).where(eq(usuarios.id, antes!.id))
    expect(depois).toEqual(antes)
  })
})
