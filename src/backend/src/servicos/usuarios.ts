import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import {
  STATUS_NAO_ENCERRADOS,
  type EntradaAlterarUsuario,
  type EntradaCriarUsuario,
  type EntradaTrocarSenha,
} from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { achados, eventosHistorico, usuarios } from '../db/schema.js'
import { ConflitoError, RecursoNaoEncontradoError, ValidacaoError } from '../dominio/erros.js'
import type { Log } from '../infra/log.js'
import { gerarHash, verificar } from '../infra/senha.js'
import { revogarSessoes } from './autenticacao.js'

const colunasPublicas = {
  id: usuarios.id,
  nome: usuarios.nome,
  email: usuarios.email,
  papel: usuarios.papel,
  ativo: usuarios.ativo,
  criadoEm: usuarios.criadoEm,
}

export async function listarUsuarios(db: BancoDados) {
  return db.select(colunasPublicas).from(usuarios).orderBy(asc(usuarios.nome))
}

/** Usuários ativos que podem ser escolhidos como responsáveis (RF15, RN11). */
export async function listarResponsaveis(db: BancoDados) {
  return db
    .select({ id: usuarios.id, nome: usuarios.nome, papel: usuarios.papel })
    .from(usuarios)
    .where(eq(usuarios.ativo, true))
    .orderBy(asc(usuarios.nome))
}

function ehViolacaoUnicidade(err: unknown): boolean {
  const causa = (err as { cause?: { code?: string } })?.cause ?? err
  return (causa as { code?: string })?.code === '23505'
}

export async function criarUsuario(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  entrada: EntradaCriarUsuario,
) {
  try {
    const [criado] = await db
      .insert(usuarios)
      .values({
        nome: entrada.nome,
        email: entrada.email,
        papel: entrada.papel,
        passwordHash: await gerarHash(entrada.senha),
      })
      .returning(colunasPublicas)
    log.info({
      evento: 'admin.usuario_criado',
      autorId: autor.id,
      usuarioId: criado!.id,
      papel: criado!.papel,
    })
    return criado!
  } catch (err) {
    if (ehViolacaoUnicidade(err)) throw new ConflitoError('Já existe um usuário com este e-mail.')
    throw err
  }
}

/**
 * Altera papel e/ou situação (RF04). A desativação revoga as sessões e aplica a RN11:
 * os achados não encerrados atribuídos ao usuário ficam sem responsável, e os que
 * estavam "Em correção" retornam a "Aberto", com registro no histórico.
 */
export async function alterarUsuario(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
  entrada: EntradaAlterarUsuario,
) {
  if (id === autor.id) {
    throw new ConflitoError('Não é possível alterar o próprio papel ou desativar a própria conta.')
  }

  return db.transaction(async (tx) => {
    const [atual] = await tx.select().from(usuarios).where(eq(usuarios.id, id)).for('update')
    if (!atual) throw new RecursoNaoEncontradoError('Usuário não encontrado.')

    const [alterado] = await tx
      .update(usuarios)
      .set({
        ...(entrada.papel !== undefined && { papel: entrada.papel }),
        ...(entrada.ativo !== undefined && { ativo: entrada.ativo }),
      })
      .where(eq(usuarios.id, id))
      .returning(colunasPublicas)

    if (entrada.papel !== undefined && entrada.papel !== atual.papel) {
      log.info({
        evento: 'admin.papel_alterado',
        autorId: autor.id,
        usuarioId: id,
        de: atual.papel,
        para: entrada.papel,
      })
      // Mudança de privilégio encerra as sessões em andamento.
      await revogarSessoes(tx, id)
    }

    if (entrada.ativo === false && atual.ativo) {
      await revogarSessoes(tx, id)
      const afetados = await liberarAchadosDoUsuario(tx, autor.id, atual)
      log.info({
        evento: 'admin.usuario_desativado',
        autorId: autor.id,
        usuarioId: id,
        achadosLiberados: afetados,
      })
    } else if (entrada.ativo === true && !atual.ativo) {
      log.info({ evento: 'admin.usuario_reativado', autorId: autor.id, usuarioId: id })
    }

    return alterado!
  })
}

type Transacao = Parameters<Parameters<BancoDados['transaction']>[0]>[0]

async function liberarAchadosDoUsuario(
  tx: Transacao,
  autorId: string,
  usuario: { id: string; nome: string },
): Promise<number> {
  const lista = await tx
    .select({ id: achados.id, status: achados.status })
    .from(achados)
    .where(
      and(
        eq(achados.responsavelId, usuario.id),
        inArray(achados.status, [...STATUS_NAO_ENCERRADOS]),
      ),
    )
    .for('update')

  const agora = new Date()
  for (const achado of lista) {
    const voltaAberto = achado.status === 'EmCorrecao'
    await tx
      .update(achados)
      .set({
        responsavelId: null,
        ...(voltaAberto && { status: 'Aberto' as const }),
        atualizadoEm: agora,
        versao: sql`${achados.versao} + 1`,
      })
      .where(eq(achados.id, achado.id))

    await tx.insert(eventosHistorico).values({
      achadoId: achado.id,
      autorId,
      tipo: 'TrocaResponsavel',
      campo: 'responsavel',
      valorAnterior: usuario.nome,
      valorNovo: null,
      justificativa: 'Responsável desativado (RN11).',
      ocorridoEm: agora,
    })
    if (voltaAberto) {
      await tx.insert(eventosHistorico).values({
        achadoId: achado.id,
        autorId,
        tipo: 'Transicao',
        campo: 'status',
        valorAnterior: 'EmCorrecao',
        valorNovo: 'Aberto',
        justificativa: 'Responsável desativado (RN11).',
        ocorridoEm: agora,
      })
    }
  }
  return lista.length
}

/** Troca da própria senha (RF05): exige a senha atual e revoga as demais sessões. */
export async function trocarSenha(
  db: BancoDados,
  log: Log,
  usuario: UsuarioSessao,
  sessaoAtualId: string | null,
  entrada: EntradaTrocarSenha,
): Promise<void> {
  const [linha] = await db
    .select({ passwordHash: usuarios.passwordHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuario.id))
  if (!linha || !(await verificar(linha.passwordHash, entrada.senhaAtual))) {
    log.warn({ evento: 'auth.troca_senha_falha', usuarioId: usuario.id })
    throw new ValidacaoError([{ campo: 'senhaAtual', mensagem: 'Senha atual incorreta.' }])
  }
  const novoHash = await gerarHash(entrada.novaSenha)
  await db.transaction(async (tx) => {
    await tx.update(usuarios).set({ passwordHash: novoHash }).where(eq(usuarios.id, usuario.id))
    await revogarSessoes(tx, usuario.id, sessaoAtualId ?? undefined)
  })
  log.info({ evento: 'auth.senha_alterada', usuarioId: usuario.id })
}
