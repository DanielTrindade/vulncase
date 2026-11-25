import { asc, eq } from 'drizzle-orm'
import type { BancoDados } from '../db/cliente.js'
import { achados, eventosHistorico, usuarios } from '../db/schema.js'
import { RecursoNaoEncontradoError } from '../dominio/erros.js'

/**
 * Histórico do achado em ordem cronológica, com o nome do autor (RF20). Este módulo
 * só lê: a tabela eventos_historico recebe apenas inserções (A07), garantidas também
 * por gatilho no banco.
 */
export async function listarHistorico(db: BancoDados, achadoId: string) {
  const [existe] = await db.select({ id: achados.id }).from(achados).where(eq(achados.id, achadoId))
  if (!existe) throw new RecursoNaoEncontradoError('Achado não encontrado.')

  return db
    .select({
      id: eventosHistorico.id,
      tipo: eventosHistorico.tipo,
      campo: eventosHistorico.campo,
      valorAnterior: eventosHistorico.valorAnterior,
      valorNovo: eventosHistorico.valorNovo,
      justificativa: eventosHistorico.justificativa,
      ocorridoEm: eventosHistorico.ocorridoEm,
      autor: { id: usuarios.id, nome: usuarios.nome },
    })
    .from(eventosHistorico)
    .innerJoin(usuarios, eq(usuarios.id, eventosHistorico.autorId))
    .where(eq(eventosHistorico.achadoId, achadoId))
    .orderBy(asc(eventosHistorico.ocorridoEm), asc(eventosHistorico.sequencia))
}
