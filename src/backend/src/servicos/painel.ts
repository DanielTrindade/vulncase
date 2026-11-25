import { and, asc, count, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import {
  SEVERIDADES,
  STATUS_ACHADO,
  STATUS_NAO_ENCERRADOS,
  type Severidade,
  type StatusAchado,
} from '@vulncase/compartilhado'
import type { BancoDados } from '../db/cliente.js'
import { achados, projetos, usuarios } from '../db/schema.js'
import { estaVencido } from '../dominio/achado.js'
import { RecursoNaoEncontradoError } from '../dominio/erros.js'
import { hojeUtc } from './achados.js'
import { condicaoVencido, pesoSeveridade } from './listagem-achados.js'

const naoEncerrado = inArray(achados.status, [...STATUS_NAO_ENCERRADOS])

function zerado<K extends string>(chaves: readonly K[]): Record<K, number> {
  return Object.fromEntries(chaves.map((k) => [k, 0])) as Record<K, number>
}

/**
 * Indicadores do UC09 (RF27, RF28). Toda a agregação é feita no banco com GROUP BY e
 * COUNT; apenas os dez achados mais graves são carregados.
 */
async function calcularIndicadores(db: BancoDados, escopo: SQL) {
  const hoje = hojeUtc()
  const grupos = await db
    .select({ severidade: achados.severidade, status: achados.status, total: count() })
    .from(achados)
    .innerJoin(projetos, eq(projetos.id, achados.projetoId))
    .where(escopo)
    .groupBy(achados.severidade, achados.status)

  const porSeveridade = zerado(SEVERIDADES)
  const abertosPorSeveridade = zerado(SEVERIDADES)
  const porStatus = zerado(STATUS_ACHADO)
  let total = 0
  for (const g of grupos) {
    porSeveridade[g.severidade as Severidade] += g.total
    porStatus[g.status as StatusAchado] += g.total
    if ((STATUS_NAO_ENCERRADOS as readonly string[]).includes(g.status)) {
      abertosPorSeveridade[g.severidade as Severidade] += g.total
    }
    total += g.total
  }

  const contar = async (condicao: SQL) => {
    const [r] = await db
      .select({ total: count() })
      .from(achados)
      .innerJoin(projetos, eq(projetos.id, achados.projetoId))
      .where(and(escopo, condicao))
    return r?.total ?? 0
  }
  const [semResponsavel, vencidos] = await Promise.all([
    contar(and(naoEncerrado, isNull(achados.responsavelId))!),
    contar(condicaoVencido(hoje)),
  ])

  const maisGraves = await db
    .select({
      id: achados.id,
      codigo: achados.codigo,
      titulo: achados.titulo,
      severidade: achados.severidade,
      status: achados.status,
      dataLimite: achados.dataLimite,
      criadoEm: achados.criadoEm,
      projeto: { id: projetos.id, prefixo: projetos.prefixo, nome: projetos.nome },
      responsavel: { id: usuarios.id, nome: usuarios.nome },
    })
    .from(achados)
    .innerJoin(projetos, eq(projetos.id, achados.projetoId))
    .leftJoin(usuarios, eq(usuarios.id, achados.responsavelId))
    .where(and(escopo, naoEncerrado))
    .orderBy(desc(pesoSeveridade), asc(achados.criadoEm), asc(achados.codigo))
    .limit(10)

  return {
    total,
    totalAbertos: STATUS_NAO_ENCERRADOS.reduce((s, st) => s + porStatus[st], 0),
    porSeveridade,
    abertosPorSeveridade,
    porStatus,
    semResponsavel,
    vencidos,
    maisGraves: maisGraves.map((a) => ({ ...a, vencido: estaVencido(a, hoje) })),
  }
}

export type Indicadores = Awaited<ReturnType<typeof calcularIndicadores>>

/** RF27: painel de um projeto (arquivado ou não). */
export async function painelProjeto(db: BancoDados, projetoId: string) {
  const [p] = await db
    .select({
      id: projetos.id,
      prefixo: projetos.prefixo,
      nome: projetos.nome,
      arquivado: projetos.arquivado,
    })
    .from(projetos)
    .where(eq(projetos.id, projetoId))
  if (!p) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
  return { projeto: p, ...(await calcularIndicadores(db, eq(achados.projetoId, projetoId))) }
}

/** RF28: mesmos indicadores agregados de todos os projetos ativos. */
export async function painelGeral(db: BancoDados) {
  const [ativos] = await db
    .select({ total: count() })
    .from(projetos)
    .where(eq(projetos.arquivado, false))
  return {
    projetosAtivos: ativos?.total ?? 0,
    ...(await calcularIndicadores(db, eq(projetos.arquivado, false))),
  }
}
