import { Hono } from 'hono'
import {
  esquemaAtribuirResponsavel,
  esquemaEditarAchado,
  esquemaFiltroAchados,
  esquemaTransicao,
  paramId,
} from '@vulncase/compartilhado'
import type { Ambiente } from '../ambiente.js'
import { analistaOuAdministrador } from '../middlewares/autorizacao.js'
import { usuarioAtual } from '../middlewares/sessao.js'
import { validar } from '../middlewares/validacao.js'
import {
  alterarResponsavel,
  detalharAchado,
  editarAchado,
  executarTransicao,
} from '../servicos/achados.js'
import { listarHistorico } from '../servicos/historico.js'
import { anexarEvidencia, listarEvidencias } from '../servicos/evidencias.js'
import { ValidacaoError } from '../dominio/erros.js'
import { listarAchados } from '../servicos/listagem-achados.js'

export const rotasAchados = new Hono<Ambiente>()
  .get('/', validar('query', esquemaFiltroAchados), async (c) =>
    c.json(await listarAchados(c.get('deps').db, c.req.valid('query')), 200),
  )
  .get('/:id', validar('param', paramId), async (c) =>
    c.json(await detalharAchado(c.get('deps').db, c.req.valid('param').id, usuarioAtual(c)), 200),
  )
  .get('/:id/historico', validar('param', paramId), async (c) =>
    c.json({ itens: await listarHistorico(c.get('deps').db, c.req.valid('param').id) }, 200),
  )
  .put(
    '/:id',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaEditarAchado),
    async (c) =>
      c.json(
        await editarAchado(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  .put(
    '/:id/responsavel',
    analistaOuAdministrador(),
    validar('param', paramId),
    validar('json', esquemaAtribuirResponsavel),
    async (c) =>
      c.json(
        await alterarResponsavel(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  // Sem exigirPapel: a Tabela 7 decide por papel e por propriedade (RN04) no domínio.
  .post(
    '/:id/transicoes',
    validar('param', paramId),
    validar('json', esquemaTransicao),
    async (c) =>
      c.json(
        await executarTransicao(
          c.get('deps').db,
          c.get('log'),
          usuarioAtual(c),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
        200,
      ),
  )
  .get('/:id/evidencias', validar('param', paramId), async (c) =>
    c.json({ itens: await listarEvidencias(c.get('deps').db, c.req.valid('param').id) }, 200),
  )
  // multipart/form-data com os campos "arquivo" e "descricao" (opcional).
  .post('/:id/evidencias', validar('param', paramId), async (c) => {
    const corpo = await c.req.parseBody()
    const arquivo = corpo.arquivo
    const descricaoBruta = corpo.descricao
    if (!(arquivo instanceof File)) {
      throw new ValidacaoError([{ campo: 'arquivo', mensagem: 'Envie um arquivo.' }])
    }
    if (descricaoBruta !== undefined && typeof descricaoBruta !== 'string') {
      throw new ValidacaoError([{ campo: 'descricao', mensagem: 'Descrição inválida.' }])
    }
    const descricao = descricaoBruta?.trim() || null
    if (descricao && descricao.length > 500) {
      throw new ValidacaoError([{ campo: 'descricao', mensagem: 'Máximo de 500 caracteres.' }])
    }
    const { db, armazenamento, config } = c.get('deps')
    const evidencia = await anexarEvidencia(
      db,
      armazenamento,
      c.get('log'),
      usuarioAtual(c),
      c.req.valid('param').id,
      { nome: arquivo.name, conteudo: new Uint8Array(await arquivo.arrayBuffer()), descricao },
      config.evidenciasTamanhoMaximoBytes,
    )
    c.header('Location', `/api/evidencias/${evidencia.id}/download`)
    return c.json(evidencia, 201)
  })
