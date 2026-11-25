import type { EntradaComentario } from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { comentarios } from '../db/schema.js'
import { podeColaborar } from '../dominio/achado.js'
import { AcessoNegadoError, ConflitoError } from '../dominio/erros.js'
import type { Log } from '../infra/log.js'
import { carregarAchado, inserirEventos } from './achados.js'

/**
 * Comentário no achado (RF21). Desenvolvedores só comentam nos achados atribuídos
 * a si. O texto também vai para o histórico, que é somente de inserção, para que a
 * conversa fique intercalada com as transições.
 */
export async function comentar(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  achadoId: string,
  entrada: EntradaComentario,
) {
  const atual = await carregarAchado(db, achadoId)
  if (atual.projeto.arquivado) throw new ConflitoError('O projeto do achado está arquivado.')
  const estado = {
    status: atual.achado.status,
    responsavel: atual.responsavel,
    encerradoEm: atual.achado.encerradoEm,
  }
  if (!podeColaborar(estado, autor)) {
    if (atual.achado.encerradoEm)
      throw new ConflitoError('Achado encerrado não aceita comentários.')
    throw new AcessoNegadoError(
      'Somente o responsável pelo achado, analistas e administradores comentam.',
    )
  }
  const agora = new Date()
  const criado = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(comentarios)
      .values({ achadoId, autorId: autor.id, texto: entrada.texto, criadoEm: agora })
      .returning()
    await inserirEventos(
      tx,
      achadoId,
      autor.id,
      [
        {
          tipo: 'Comentario',
          campo: 'comentario',
          valorAnterior: null,
          valorNovo: entrada.texto,
          justificativa: null,
        },
      ],
      agora,
    )
    return c!
  })
  log.info({ evento: 'achado.comentario', autorId: autor.id, achadoId, comentarioId: criado.id })
  return {
    id: criado.id,
    texto: criado.texto,
    criadoEm: criado.criadoEm,
    autor: { id: autor.id, nome: autor.nome },
  }
}
