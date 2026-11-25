import { and, asc, eq } from 'drizzle-orm'
import type { EntradaAtivo } from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { ativos, projetos } from '../db/schema.js'
import { ConflitoError, RecursoNaoEncontradoError, ValidacaoError } from '../dominio/erros.js'
import type { Log } from '../infra/log.js'
import type { Transacao } from './achados.js'
import { ehViolacaoUnicidade } from './erros-banco.js'

const colunas = {
  id: ativos.id,
  nome: ativos.nome,
  tipo: ativos.tipo,
  identificador: ativos.identificador,
  ambiente: ativos.ambiente,
  criadoEm: ativos.criadoEm,
}

async function projetoExistente(db: BancoDados, projetoId: string) {
  const [p] = await db.select().from(projetos).where(eq(projetos.id, projetoId))
  if (!p) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
  return p
}

export async function listarAtivos(db: BancoDados, projetoId: string) {
  await projetoExistente(db, projetoId)
  return db
    .select(colunas)
    .from(ativos)
    .where(eq(ativos.projetoId, projetoId))
    .orderBy(asc(ativos.nome))
}

export async function criarAtivo(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  projetoId: string,
  entrada: EntradaAtivo,
) {
  const p = await projetoExistente(db, projetoId)
  if (p.arquivado) throw new ConflitoError('Projeto arquivado não aceita novos ativos.')
  try {
    const [criado] = await db
      .insert(ativos)
      .values({ ...entrada, projetoId })
      .returning(colunas)
    log.info({ evento: 'ativo.criado', autorId: autor.id, projetoId, ativoId: criado!.id })
    return criado!
  } catch (err) {
    if (ehViolacaoUnicidade(err))
      throw new ConflitoError('Já existe um ativo com este nome no projeto.')
    throw err
  }
}

/** RF22: o ativo vinculado precisa pertencer ao mesmo projeto do achado. */
export async function descreverAtivoDoProjeto(
  db: BancoDados | Transacao,
  ativoId: string | null,
  projetoId: string,
): Promise<string | null> {
  if (ativoId === null) return null
  const [a] = await db
    .select({ nome: ativos.nome })
    .from(ativos)
    .where(and(eq(ativos.id, ativoId), eq(ativos.projetoId, projetoId)))
  if (!a) {
    throw new ValidacaoError([{ campo: 'ativoId', mensagem: 'Escolha um ativo deste projeto.' }])
  }
  return a.nome
}
