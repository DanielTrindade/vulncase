import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { STATUS_NAO_ENCERRADOS, type FiltroAchados } from '@vulncase/compartilhado'
import type { BancoDados } from '../db/cliente.js'
import { achados, categoriasOwasp, projetos, usuarios } from '../db/schema.js'
import { estaVencido } from '../dominio/achado.js'
import { hojeUtc } from './achados.js'

/** Peso da severidade para ordenação; os valores são constantes do código, não entrada. */
export const pesoSeveridade = sql<number>`CASE ${achados.severidade}
  WHEN 'Critica' THEN 5 WHEN 'Alta' THEN 4 WHEN 'Media' THEN 3 WHEN 'Baixa' THEN 2 ELSE 1 END`

/** Escapa curingas do LIKE para que a busca seja literal. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** RN09 em SQL: data-limite anterior a hoje e achado não encerrado. */
export function condicaoVencido(hoje: string): SQL {
  return and(lt(achados.dataLimite, hoje), inArray(achados.status, [...STATUS_NAO_ENCERRADOS]))!
}

/**
 * Monta as condições a partir de filtros já validados pelo Zod. Todos os valores
 * seguem como parâmetros da consulta (RNF08).
 */
export function condicoesFiltro(
  f: Omit<FiltroAchados, 'ordenarPor' | 'ordem' | 'pagina' | 'tamanhoPagina'>,
  hoje: string,
) {
  const c: SQL[] = []
  // Sem projeto informado, a listagem considera apenas projetos ativos.
  c.push(f.projetoId ? eq(achados.projetoId, f.projetoId) : eq(projetos.arquivado, false))
  if (f.status?.length) c.push(inArray(achados.status, f.status))
  if (f.severidade?.length) c.push(inArray(achados.severidade, f.severidade))
  if (f.responsavelId) c.push(eq(achados.responsavelId, f.responsavelId))
  if (f.semResponsavel === true) c.push(isNull(achados.responsavelId))
  if (f.semResponsavel === false) c.push(not(isNull(achados.responsavelId)))
  if (f.categoriaOwaspId) c.push(eq(achados.categoriaOwaspId, f.categoriaOwaspId))
  if (f.ativoId) c.push(eq(achados.ativoId, f.ativoId))
  if (f.vencido === true) c.push(condicaoVencido(hoje))
  if (f.vencido === false) {
    c.push(or(isNull(achados.dataLimite), not(condicaoVencido(hoje)))!)
  }
  if (f.busca) {
    const padrao = `%${escaparLike(f.busca)}%`
    c.push(or(ilike(achados.titulo, padrao), ilike(achados.codigo, padrao))!)
  }
  return and(...c)
}

function ordenacao(f: FiltroAchados) {
  const dir = f.ordem === 'asc' ? asc : desc
  const principal =
    f.ordenarPor === 'severidade'
      ? [dir(pesoSeveridade)]
      : f.ordenarPor === 'dataLimite'
        ? // Sem data-limite sempre por último.
          [sql`${achados.dataLimite} IS NULL`, dir(achados.dataLimite)]
        : [dir(achados.criadoEm)]
  return [...principal, desc(achados.criadoEm), asc(achados.codigo)]
}

/** GET /api/achados com filtros combináveis, paginação e ordenação (RF18). */
export async function listarAchados(db: BancoDados, f: FiltroAchados) {
  const hoje = hojeUtc()
  const onde = condicoesFiltro(f, hoje)

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(achados)
    .innerJoin(projetos, eq(projetos.id, achados.projetoId))
    .where(onde)

  const linhas = await db
    .select({
      id: achados.id,
      codigo: achados.codigo,
      titulo: achados.titulo,
      origem: achados.origem,
      severidade: achados.severidade,
      status: achados.status,
      cweId: achados.cweId,
      dataLimite: achados.dataLimite,
      criadoEm: achados.criadoEm,
      atualizadoEm: achados.atualizadoEm,
      projeto: { id: projetos.id, prefixo: projetos.prefixo, nome: projetos.nome },
      responsavel: { id: usuarios.id, nome: usuarios.nome },
      categoriaOwasp: { id: categoriasOwasp.id, codigo: categoriasOwasp.codigo },
    })
    .from(achados)
    .innerJoin(projetos, eq(projetos.id, achados.projetoId))
    .leftJoin(usuarios, eq(usuarios.id, achados.responsavelId))
    .leftJoin(categoriasOwasp, eq(categoriasOwasp.id, achados.categoriaOwaspId))
    .where(onde)
    .orderBy(...ordenacao(f))
    .limit(f.tamanhoPagina)
    .offset((f.pagina - 1) * f.tamanhoPagina)

  return {
    itens: linhas.map((l) => ({ ...l, vencido: estaVencido(l, hoje) })),
    total,
    pagina: f.pagina,
    tamanhoPagina: f.tamanhoPagina,
    totalPaginas: Math.max(1, Math.ceil(total / f.tamanhoPagina)),
  }
}
