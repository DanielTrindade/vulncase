import { Hono } from 'hono'
import { paramId } from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import { obterArquivoEvidencia, removerEvidencia } from '../servicos/evidencias.js'

/** Content-Disposition com nome ASCII seguro e a forma RFC 5987 para UTF-8. */
function contentDisposition(nome: string): string {
  const ascii = nome
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\;]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`
}

export const rotasEvidencias = new Hono<Ambiente>()
  .get('/:id/download', validar('param', paramId), async (c) => {
    const { db, armazenamento } = c.get('deps')
    const { evidencia, conteudo } = await obterArquivoEvidencia(
      db,
      armazenamento,
      c.get('log'),
      usuarioAtual(c),
      c.req.valid('param').id,
    )
    // RNF15, A05: sempre anexo, com o tipo determinado pelo servidor e sem
    // interpretação pelo navegador.
    return c.body(new Uint8Array(conteudo), 200, {
      'Content-Type': evidencia.tipoConteudo,
      'Content-Disposition': contentDisposition(evidencia.nomeOriginal),
      'Content-Length': String(conteudo.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'no-store',
    })
  })
  // Autorização por papel e autoria no serviço (Analista, Admin ou quem enviou).
  .delete('/:id', validar('param', paramId), async (c) => {
    const { db, armazenamento } = c.get('deps')
    await removerEvidencia(
      db,
      armazenamento,
      c.get('log'),
      usuarioAtual(c),
      c.req.valid('param').id,
    )
    return c.body(null, 204)
  })
