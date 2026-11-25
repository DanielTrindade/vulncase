import { and, asc, count, eq, inArray } from 'drizzle-orm'
import {
  SEVERIDADES,
  STATUS_NAO_ENCERRADOS,
  type EntradaProjeto,
  type Severidade,
} from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { achados, projetos, usuarios } from '../db/schema.js'
import { ConflitoError, RecursoNaoEncontradoError, ValidacaoError } from '../dominio/erros.js'
import type { Log } from '../infra/log.js'
import { ehViolacaoUnicidade } from './erros-banco.js'

export type ContagemSeveridade = Record<Severidade, number>

export function contagemVazia(): ContagemSeveridade {
  return Object.fromEntries(SEVERIDADES.map((s) => [s, 0])) as ContagemSeveridade
}

const colunasProjeto = {
  id: projetos.id,
  prefixo: projetos.prefixo,
  nome: projetos.nome,
  descricao: projetos.descricao,
  arquivado: projetos.arquivado,
  proximoNumeroAchado: projetos.proximoNumeroAchado,
  criadoEm: projetos.criadoEm,
  atualizadoEm: projetos.atualizadoEm,
  responsavelTecnicoId: usuarios.id,
  responsavelTecnicoNome: usuarios.nome,
}

interface LinhaProjeto {
  id: string
  prefixo: string
  nome: string
  descricao: string | null
  arquivado: boolean
  proximoNumeroAchado: number
  criadoEm: Date
  atualizadoEm: Date
  responsavelTecnicoId: string
  responsavelTecnicoNome: string
}

async function contarAbertos(db: BancoDados, ids: string[]) {
  const mapa = new Map<string, ContagemSeveridade>()
  if (ids.length === 0) return mapa
  const linhas = await db
    .select({ projetoId: achados.projetoId, severidade: achados.severidade, total: count() })
    .from(achados)
    .where(
      and(inArray(achados.projetoId, ids), inArray(achados.status, [...STATUS_NAO_ENCERRADOS])),
    )
    .groupBy(achados.projetoId, achados.severidade)
  for (const l of linhas) {
    const c = mapa.get(l.projetoId) ?? contagemVazia()
    c[l.severidade] = l.total
    mapa.set(l.projetoId, c)
  }
  return mapa
}

function formatar(p: LinhaProjeto, abertos: ContagemSeveridade) {
  return {
    id: p.id,
    prefixo: p.prefixo,
    nome: p.nome,
    descricao: p.descricao,
    arquivado: p.arquivado,
    responsavelTecnico: { id: p.responsavelTecnicoId, nome: p.responsavelTecnicoNome },
    /** O prefixo só pode mudar enquanto o projeto não tem achados (RN02). */
    prefixoEditavel: p.proximoNumeroAchado === 1,
    abertosPorSeveridade: abertos,
    totalAbertos: Object.values(abertos).reduce((a, b) => a + b, 0),
    criadoEm: p.criadoEm,
    atualizadoEm: p.atualizadoEm,
  }
}

export type ProjetoDto = ReturnType<typeof formatar>

/** RF10: lista projetos com a contagem de achados abertos por severidade. */
export async function listarProjetos(db: BancoDados, arquivados: boolean): Promise<ProjetoDto[]> {
  const linhas = await db
    .select(colunasProjeto)
    .from(projetos)
    .innerJoin(usuarios, eq(usuarios.id, projetos.responsavelTecnicoId))
    .where(eq(projetos.arquivado, arquivados))
    .orderBy(asc(projetos.nome))
  const contagens = await contarAbertos(
    db,
    linhas.map((l) => l.id),
  )
  return linhas.map((l) => formatar(l, contagens.get(l.id) ?? contagemVazia()))
}

export async function obterProjeto(db: BancoDados, id: string): Promise<ProjetoDto> {
  const [linha] = await db
    .select(colunasProjeto)
    .from(projetos)
    .innerJoin(usuarios, eq(usuarios.id, projetos.responsavelTecnicoId))
    .where(eq(projetos.id, id))
  if (!linha) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
  const contagens = await contarAbertos(db, [id])
  return formatar(linha, contagens.get(id) ?? contagemVazia())
}

async function garantirResponsavelAtivo(db: BancoDados, id: string): Promise<void> {
  const [u] = await db.select({ ativo: usuarios.ativo }).from(usuarios).where(eq(usuarios.id, id))
  if (!u?.ativo) {
    throw new ValidacaoError([
      { campo: 'responsavelTecnicoId', mensagem: 'Informe um usuário ativo.' },
    ])
  }
}

const PREFIXO_DUPLICADO = 'Já existe um projeto com este prefixo.'

export async function criarProjeto(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  entrada: EntradaProjeto,
): Promise<ProjetoDto> {
  await garantirResponsavelAtivo(db, entrada.responsavelTecnicoId)
  try {
    const [criado] = await db.insert(projetos).values(entrada).returning({ id: projetos.id })
    log.info({ evento: 'projeto.criado', autorId: autor.id, projetoId: criado!.id })
    return obterProjeto(db, criado!.id)
  } catch (err) {
    if (ehViolacaoUnicidade(err, 'projetos_prefixo_uq')) throw new ConflitoError(PREFIXO_DUPLICADO)
    throw err
  }
}

/** RF08. O prefixo é imutável após o primeiro achado; projeto arquivado não é editado. */
export async function editarProjeto(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
  entrada: EntradaProjeto,
): Promise<ProjetoDto> {
  await garantirResponsavelAtivo(db, entrada.responsavelTecnicoId)
  try {
    await db.transaction(async (tx) => {
      const [atual] = await tx.select().from(projetos).where(eq(projetos.id, id)).for('update')
      if (!atual) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
      if (atual.arquivado) throw new ConflitoError('Projeto arquivado não pode ser editado.')
      if (entrada.prefixo !== atual.prefixo && atual.proximoNumeroAchado > 1) {
        throw new ConflitoError('O prefixo não pode ser alterado depois do primeiro achado.')
      }
      await tx
        .update(projetos)
        .set({ ...entrada, atualizadoEm: new Date() })
        .where(eq(projetos.id, id))
    })
  } catch (err) {
    if (ehViolacaoUnicidade(err, 'projetos_prefixo_uq')) throw new ConflitoError(PREFIXO_DUPLICADO)
    throw err
  }
  log.info({ evento: 'projeto.editado', autorId: autor.id, projetoId: id })
  return obterProjeto(db, id)
}

/** RF09, RN08: só arquiva sem achados em Aberto, Em correção ou Aguardando verificação. */
export async function arquivarProjeto(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
): Promise<ProjetoDto> {
  await db.transaction(async (tx) => {
    const [atual] = await tx.select().from(projetos).where(eq(projetos.id, id)).for('update')
    if (!atual) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
    if (atual.arquivado) throw new ConflitoError('O projeto já está arquivado.')
    const [pendentes] = await tx
      .select({ total: count() })
      .from(achados)
      .where(and(eq(achados.projetoId, id), inArray(achados.status, [...STATUS_NAO_ENCERRADOS])))
    if ((pendentes?.total ?? 0) > 0) {
      throw new ConflitoError(
        `O projeto possui ${pendentes!.total} achado(s) não encerrado(s) e não pode ser arquivado.`,
      )
    }
    await tx
      .update(projetos)
      .set({ arquivado: true, atualizadoEm: new Date() })
      .where(eq(projetos.id, id))
  })
  log.info({ evento: 'projeto.arquivado', autorId: autor.id, projetoId: id })
  return obterProjeto(db, id)
}
