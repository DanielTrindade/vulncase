import { count, sql } from 'drizzle-orm'
import { esquemaEmail } from '@vulncase/compartilhado'
import type { Log } from '../infra/log.js'
import { gerarHash } from '../infra/senha.js'
import type { BancoDados } from './cliente.js'
import { usuarios } from './schema.js'

/**
 * Cria o primeiro administrador a partir de ADMIN_EMAIL_INICIAL e ADMIN_SENHA_INICIAL,
 * somente quando a tabela de usuários está vazia. Reinícios não recriam nem alteram
 * o administrador.
 */
export async function criarAdministradorInicial(
  db: BancoDados,
  config: { adminEmailInicial?: string | undefined; adminSenhaInicial?: string | undefined },
  log: Log,
): Promise<'criado' | 'existente' | 'sem-configuracao'> {
  return db.transaction(async (tx) => {
    // Serializa inicializações concorrentes de várias instâncias da API.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4242001)`)
    const [linha] = await tx.select({ total: count() }).from(usuarios)
    if ((linha?.total ?? 0) > 0) return 'existente'

    if (!config.adminEmailInicial || !config.adminSenhaInicial) {
      log.warn('nenhum usuário cadastrado e ADMIN_EMAIL_INICIAL/ADMIN_SENHA_INICIAL não definidos')
      return 'sem-configuracao'
    }

    const email = esquemaEmail.parse(config.adminEmailInicial)
    const [criado] = await tx
      .insert(usuarios)
      .values({
        nome: 'Administrador',
        email,
        passwordHash: await gerarHash(config.adminSenhaInicial),
        papel: 'Administrador',
      })
      .returning({ id: usuarios.id })
    log.info(
      { evento: 'admin.inicial_criado', usuarioId: criado?.id },
      'administrador inicial criado',
    )
    return 'criado'
  })
}
