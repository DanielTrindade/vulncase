import { and, eq, lt, sql } from 'drizzle-orm'
import type { EntradaLogin } from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { sessoes, usuarios } from '../db/schema.js'
import { ContaBloqueadaError, NaoAutenticadoError } from '../dominio/erros.js'
import type { Log } from '../infra/log.js'
import { verificar, verificarFicticio } from '../infra/senha.js'
import { gerarTokenSessao, hashToken } from '../infra/token.js'
import { DURACAO_SESSAO_MS } from '../middlewares/sessao.js'

/** RNF03: 5 falhas bloqueiam a conta por 15 minutos. */
export const MAXIMO_TENTATIVAS = 5
export const DURACAO_BLOQUEIO_MS = 15 * 60 * 1000

const MENSAGEM_CREDENCIAL_INVALIDA = 'E-mail ou senha inválidos.'

export interface ResultadoLogin {
  usuario: UsuarioSessao
  token: string
  expiraEm: Date
}

export interface Contexto {
  db: BancoDados
  log: Log
  ip: string | null
  userAgent: string | null
}

/**
 * Entrada no sistema (RF01). Usuário inexistente, inativo e senha errada recebem a
 * mesma resposta e passam por uma verificação Argon2 de custo equivalente (A01).
 */
export async function entrar(entrada: EntradaLogin, ctx: Contexto): Promise<ResultadoLogin> {
  const { db, log } = ctx
  const agora = new Date()
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(sql`lower(${usuarios.email})`, entrada.email))
    .limit(1)

  if (!usuario) {
    await verificarFicticio(entrada.senha)
    log.warn({ evento: 'auth.login_falha', motivo: 'usuario_inexistente', email: entrada.email })
    throw new NaoAutenticadoError(MENSAGEM_CREDENCIAL_INVALIDA)
  }

  if (usuario.bloqueadoAte && usuario.bloqueadoAte > agora) {
    log.warn({ evento: 'auth.login_bloqueado', usuarioId: usuario.id })
    throw new ContaBloqueadaError()
  }

  const senhaCorreta = await verificar(usuario.passwordHash, entrada.senha)

  if (!senhaCorreta) {
    const limite = new Date(agora.getTime() + DURACAO_BLOQUEIO_MS)
    // Incremento atômico: no limite, zera o contador e define o fim do bloqueio.
    const [apos] = await db
      .update(usuarios)
      .set({
        tentativasFalhas: sql`CASE WHEN ${usuarios.tentativasFalhas} + 1 >= ${MAXIMO_TENTATIVAS} THEN 0 ELSE ${usuarios.tentativasFalhas} + 1 END`,
        bloqueadoAte: sql`CASE WHEN ${usuarios.tentativasFalhas} + 1 >= ${MAXIMO_TENTATIVAS} THEN ${limite}::timestamptz ELSE ${usuarios.bloqueadoAte} END`,
      })
      .where(eq(usuarios.id, usuario.id))
      .returning({ bloqueadoAte: usuarios.bloqueadoAte })
    log.warn({ evento: 'auth.login_falha', motivo: 'senha_incorreta', usuarioId: usuario.id })
    if (apos?.bloqueadoAte && apos.bloqueadoAte > agora) {
      log.warn({ evento: 'auth.conta_bloqueada', usuarioId: usuario.id, ate: apos.bloqueadoAte })
    }
    throw new NaoAutenticadoError(MENSAGEM_CREDENCIAL_INVALIDA)
  }

  if (!usuario.ativo) {
    log.warn({ evento: 'auth.login_falha', motivo: 'usuario_inativo', usuarioId: usuario.id })
    throw new NaoAutenticadoError(MENSAGEM_CREDENCIAL_INVALIDA)
  }

  // Novo token a cada entrada (A19); sessões vencidas do usuário são descartadas.
  const token = gerarTokenSessao()
  const expiraEm = new Date(agora.getTime() + DURACAO_SESSAO_MS)
  await db.transaction(async (tx) => {
    await tx
      .update(usuarios)
      .set({ tentativasFalhas: 0, bloqueadoAte: null })
      .where(eq(usuarios.id, usuario.id))
    await tx
      .delete(sessoes)
      .where(and(eq(sessoes.usuarioId, usuario.id), lt(sessoes.expiraEm, agora)))
    await tx.insert(sessoes).values({
      usuarioId: usuario.id,
      tokenHash: hashToken(token),
      criadaEm: agora,
      expiraEm,
      ip: ctx.ip?.slice(0, 64) ?? null,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
    })
  })

  log.info({ evento: 'auth.login_sucesso', usuarioId: usuario.id })
  return {
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    token,
    expiraEm,
  }
}

export async function sair(db: BancoDados, sessaoId: string): Promise<void> {
  await db.delete(sessoes).where(eq(sessoes.id, sessaoId))
}

/** Revoga todas as sessões do usuário, exceto, opcionalmente, a atual. */
export async function revogarSessoes(
  db: Pick<BancoDados, 'delete'>,
  usuarioId: string,
  manterSessaoId?: string,
): Promise<void> {
  await db
    .delete(sessoes)
    .where(
      manterSessaoId
        ? and(eq(sessoes.usuarioId, usuarioId), sql`${sessoes.id} <> ${manterSessaoId}`)
        : eq(sessoes.usuarioId, usuarioId),
    )
}
