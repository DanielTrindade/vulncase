import { createHash } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { evidencias, usuarios } from '../db/schema.js'
import { podeColaborar, podeRemoverEvidencia } from '../dominio/achado.js'
import {
  AcessoNegadoError,
  ConflitoError,
  ErroAplicacao,
  RecursoNaoEncontradoError,
} from '../dominio/erros.js'
import type { Armazenamento } from '../infra/armazenamento.js'
import type { Log } from '../infra/log.js'
import {
  EXTENSOES_PERMITIDAS,
  identificarTipo,
  sanitizarNomeArquivo,
} from '../infra/tipos-arquivo.js'
import { carregarAchado, inserirEventos } from './achados.js'

export class TipoNaoPermitidoError extends ErroAplicacao {
  readonly status = 415
  readonly titulo = 'Tipo de arquivo não permitido'
}

export class ArquivoGrandeError extends ErroAplicacao {
  readonly status = 413
  readonly titulo = 'Arquivo muito grande'
}

const colunas = {
  id: evidencias.id,
  nomeOriginal: evidencias.nomeOriginal,
  tipoConteudo: evidencias.tipoConteudo,
  tamanhoBytes: evidencias.tamanhoBytes,
  hashSha256: evidencias.hashSha256,
  descricao: evidencias.descricao,
  enviadaEm: evidencias.enviadaEm,
  enviadaPor: { id: usuarios.id, nome: usuarios.nome },
}

export async function listarEvidencias(db: BancoDados, achadoId: string) {
  await carregarAchado(db, achadoId)
  return db
    .select(colunas)
    .from(evidencias)
    .innerJoin(usuarios, eq(usuarios.id, evidencias.enviadaPorId))
    .where(eq(evidencias.achadoId, achadoId))
    .orderBy(asc(evidencias.enviadaEm))
}

interface Envio {
  nome: string
  conteudo: Uint8Array
  descricao: string | null
}

/** Envio de evidência (Figura 8 do documento 03). */
export async function anexarEvidencia(
  db: BancoDados,
  armazenamento: Armazenamento,
  log: Log,
  autor: UsuarioSessao,
  achadoId: string,
  envio: Envio,
  tamanhoMaximo: number,
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
      throw new ConflitoError('Achado encerrado não aceita novas evidências.')
    throw new AcessoNegadoError(
      'Somente o responsável pelo achado, analistas e administradores anexam evidências.',
    )
  }

  if (envio.conteudo.byteLength === 0) throw new TipoNaoPermitidoError('O arquivo está vazio.')
  if (envio.conteudo.byteLength > tamanhoMaximo) {
    throw new ArquivoGrandeError(
      `O arquivo excede o limite de ${Math.floor(tamanhoMaximo / 1024 / 1024)} MB.`,
    )
  }
  const nomeOriginal = sanitizarNomeArquivo(envio.nome)
  const tipo = identificarTipo(nomeOriginal, envio.conteudo)
  if (!tipo.ok) {
    log.warn({ evento: 'evidencia.recusada', motivo: tipo.motivo, autorId: autor.id, achadoId })
    throw new TipoNaoPermitidoError(
      tipo.motivo === 'extensao'
        ? `Extensões aceitas: ${EXTENSOES_PERMITIDAS.join(', ')}.`
        : 'O conteúdo do arquivo não corresponde à extensão informada.',
    )
  }

  const hashSha256 = createHash('sha256').update(envio.conteudo).digest('hex')
  const nomeArmazenado = await armazenamento.gravar(envio.conteudo)
  const agora = new Date()
  try {
    const id = await db.transaction(async (tx) => {
      const [criada] = await tx
        .insert(evidencias)
        .values({
          achadoId,
          nomeOriginal,
          nomeArmazenado,
          tipoConteudo: tipo.tipoConteudo,
          tamanhoBytes: envio.conteudo.byteLength,
          hashSha256,
          descricao: envio.descricao,
          enviadaPorId: autor.id,
          enviadaEm: agora,
        })
        .returning({ id: evidencias.id })
      await inserirEventos(
        tx,
        achadoId,
        autor.id,
        [
          {
            tipo: 'EvidenciaAdicionada',
            campo: 'evidencia',
            valorAnterior: null,
            valorNovo: nomeOriginal,
            justificativa: envio.descricao,
          },
        ],
        agora,
      )
      return criada!.id
    })
    log.info({
      evento: 'evidencia.adicionada',
      autorId: autor.id,
      achadoId,
      evidenciaId: id,
      hashSha256,
    })
    const [dto] = await db
      .select(colunas)
      .from(evidencias)
      .innerJoin(usuarios, eq(usuarios.id, evidencias.enviadaPorId))
      .where(eq(evidencias.id, id))
    return dto!
  } catch (err) {
    // Sem registro no banco, o arquivo não deve ficar órfão no volume.
    await armazenamento.remover(nomeArmazenado)
    throw err
  }
}

async function buscar(db: BancoDados, id: string) {
  const [e] = await db.select().from(evidencias).where(eq(evidencias.id, id))
  if (!e) throw new RecursoNaoEncontradoError('Evidência não encontrada.')
  return e
}

/**
 * Download (RF26, A10): exige sessão e confere que a evidência e o achado existem.
 * O tipo de conteúdo é o determinado pelo servidor no envio.
 */
export async function obterArquivoEvidencia(
  db: BancoDados,
  armazenamento: Armazenamento,
  log: Log,
  usuario: UsuarioSessao,
  id: string,
) {
  const e = await buscar(db, id)
  await carregarAchado(db, e.achadoId)
  const conteudo = await armazenamento.ler(e.nomeArmazenado)
  log.info({ evento: 'evidencia.baixada', usuarioId: usuario.id, evidenciaId: id })
  return { evidencia: e, conteudo }
}

export async function removerEvidencia(
  db: BancoDados,
  armazenamento: Armazenamento,
  log: Log,
  autor: UsuarioSessao,
  id: string,
) {
  const e = await buscar(db, id)
  const atual = await carregarAchado(db, e.achadoId)
  if (atual.projeto.arquivado) throw new ConflitoError('O projeto do achado está arquivado.')
  if (!podeRemoverEvidencia(atual.achado, e, autor)) {
    if (atual.achado.encerradoEm)
      throw new ConflitoError('Achado encerrado não permite remover evidências.')
    throw new AcessoNegadoError(
      'Somente quem enviou a evidência, analistas e administradores a removem.',
    )
  }
  const agora = new Date()
  await db.transaction(async (tx) => {
    await tx.delete(evidencias).where(eq(evidencias.id, id))
    await inserirEventos(
      tx,
      e.achadoId,
      autor.id,
      [
        {
          tipo: 'EvidenciaRemovida',
          campo: 'evidencia',
          valorAnterior: e.nomeOriginal,
          valorNovo: null,
          justificativa: null,
        },
      ],
      agora,
    )
  })
  await armazenamento.remover(e.nomeArmazenado)
  log.info({
    evento: 'evidencia.removida',
    autorId: autor.id,
    evidenciaId: id,
    achadoId: e.achadoId,
  })
}
