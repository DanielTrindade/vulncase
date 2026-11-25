import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { eventosHistorico, evidencias } from '../../src/db/schema.js'
import { criarAmbienteTeste, type AmbienteTeste } from '../apoio/app-teste.js'
import { HTML, PDF, PNG, SVG, TXT } from '../apoio/arquivos.js'
import { criarAchadoApi, criarProjetoApi, type AchadoResposta } from '../apoio/fabricas.js'

type Sessao = Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
interface Evidencia {
  id: string
  nomeOriginal: string
  tipoConteudo: string
  tamanhoBytes: number
  hashSha256: string
  descricao: string | null
  enviadaPor: { id: string; nome: string }
}

describe('evidências', () => {
  let t: AmbienteTeste
  let analista: Sessao
  let dev: Sessao
  let outroDev: Sessao
  let projetoId: string

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    analista = await t.sessaoDe('Analista')
    dev = await t.sessaoDe('Desenvolvedor')
    outroDev = await t.sessaoDe('Desenvolvedor')
    projetoId = (await criarProjetoApi(t, analista.cookie, analista.usuario.id)).id
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  const achado = (extra: Record<string, unknown> = {}) =>
    criarAchadoApi(t, analista.cookie, projetoId, extra)
  const enviar = (
    s: Sessao,
    a: { id: string },
    nome: string,
    conteudo: Uint8Array,
    tipo?: string,
    descricao?: string,
  ) =>
    t.enviarArquivo(
      `/api/achados/${a.id}/evidencias`,
      s.cookie,
      { nome, conteudo, tipo },
      descricao,
    )

  it('anexa PNG: 201, SHA-256, nome UUID no disco e evento no histórico', async () => {
    const a = await achado()
    const res = await enviar(
      analista,
      a,
      'captura da tela.png',
      PNG,
      'image/png',
      'Tela de login vulnerável',
    )
    expect(res.status).toBe(201)
    const e = (await res.json()) as Evidencia
    expect(e).toMatchObject({
      nomeOriginal: 'captura da tela.png',
      tipoConteudo: 'image/png',
      tamanhoBytes: PNG.byteLength,
      hashSha256: createHash('sha256').update(PNG).digest('hex'),
      descricao: 'Tela de login vulnerável',
      enviadaPor: { id: analista.usuario.id },
    })
    const [linha] = await t.db.select().from(evidencias).where(eq(evidencias.id, e.id))
    expect(linha!.nomeArmazenado).toMatch(/^[0-9a-f-]{36}$/)
    expect(await readdir(t.diretorioEvidencias)).toContain(linha!.nomeArmazenado)
    const eventos = await t.db
      .select()
      .from(eventosHistorico)
      .where(eq(eventosHistorico.achadoId, a.id))
    expect(eventos.find((x) => x.tipo === 'EvidenciaAdicionada')).toMatchObject({
      valorNovo: 'captura da tela.png',
    })

    const lista = (await (
      await t.requisitar(`/api/achados/${a.id}/evidencias`, { cookie: dev.cookie })
    ).json()) as {
      itens: Evidencia[]
    }
    expect(lista.itens.map((i) => i.id)).toEqual([e.id])
  })

  it('.html renomeado para .png retorna 415 e nada é gravado', async () => {
    const a = await achado()
    const antes = (await readdir(t.diretorioEvidencias)).length
    const res = await enviar(analista, a, 'inofensivo.png', HTML, 'image/png')
    expect(res.status).toBe(415)
    expect((await readdir(t.diretorioEvidencias)).length).toBe(antes)
  })

  it.each([
    ['pagina.html', HTML],
    ['vetor.svg', SVG],
    ['captura.png.html', HTML],
  ])('extensão não permitida %s retorna 415', async (nome, conteudo) => {
    const a = await achado()
    expect((await enviar(analista, a, nome, conteudo)).status).toBe(415)
  })

  it('arquivo acima de 5 MB retorna 413', async () => {
    const a = await achado()
    const grande = new Uint8Array(t.config.evidenciasTamanhoMaximoBytes + 1)
    grande.set(PNG)
    const res = await enviar(analista, a, 'grande.png', grande)
    expect(res.status).toBe(413)
  })

  it('corpo multipart muito acima do limite é recusado antes da leitura (413)', async () => {
    const a = await achado()
    const enorme = new Uint8Array(t.config.evidenciasTamanhoMaximoBytes + 512 * 1024)
    enorme.set(PNG)
    const res = await enviar(analista, a, 'enorme.png', enorme)
    expect(res.status).toBe(413)
  })

  it('as demais rotas JSON mantêm o limite de 64 KB', async () => {
    const a = await achado()
    const res = await t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { destino: 'FalsoPositivo', justificativa: 'x'.repeat(70 * 1024), versao: 1 },
    })
    expect(res.status).toBe(413)
  })

  it('sem arquivo retorna 400; descrição longa retorna 400', async () => {
    const a = await achado()
    const form = new FormData()
    form.append('descricao', 'só texto')
    const r1 = await t.app.request(`/api/achados/${a.id}/evidencias`, {
      method: 'POST',
      headers: { Origin: 'https://localhost', Cookie: analista.cookie },
      body: form,
    })
    expect(r1.status).toBe(400)
    expect((await enviar(analista, a, 'a.txt', TXT, undefined, 'x'.repeat(501))).status).toBe(400)
  })

  it('desenvolvedor só envia em achado atribuído a ele', async () => {
    const a = await achado({ responsavelId: dev.usuario.id })
    expect((await enviar(outroDev, a, 'log.txt', TXT)).status).toBe(403)
    expect((await enviar(dev, a, 'log.txt', TXT)).status).toBe(201)
  })

  it('achado encerrado não aceita evidência (409)', async () => {
    const a = await achado()
    await t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { destino: 'FalsoPositivo', justificativa: 'não reproduz', versao: 1 },
    })
    expect((await enviar(analista, a, 'relatorio.pdf', PDF)).status).toBe(409)
  })

  describe('download', () => {
    it('serve como anexo, com o tipo determinado pelo servidor e nosniff', async () => {
      const a = await achado()
      // O navegador declara text/html; o servidor ignora e grava image/png.
      const e = (await (
        await enviar(analista, a, 'tela.png', PNG, 'text/html')
      ).json()) as Evidencia
      expect(e.tipoConteudo).toBe('image/png')
      const res = await t.requisitar(`/api/evidencias/${e.id}/download`, { cookie: dev.cookie })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="tela.png"/)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toContain('sandbox')
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
    })

    it('texto com HTML é servido como text/plain', async () => {
      const a = await achado()
      const e = (await (
        await enviar(analista, a, 'resposta.txt', HTML, 'text/html')
      ).json()) as Evidencia
      const res = await t.requisitar(`/api/evidencias/${e.id}/download`, { cookie: dev.cookie })
      expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    })

    it('nome com caminho e caracteres especiais é neutralizado no cabeçalho', async () => {
      const a = await achado()
      const e = (await (
        await enviar(
          analista,
          a,
          '../../etc/"captura"\r\nX-Injetado: 1.pcap'.replace('.pcap', '.txt'),
          TXT,
        )
      ).json()) as Evidencia
      expect(e.nomeOriginal).not.toContain('/')
      const res = await t.requisitar(`/api/evidencias/${e.id}/download`, { cookie: dev.cookie })
      const cd = res.headers.get('content-disposition') ?? ''
      expect(cd).not.toMatch(/[\r\n]/)
      expect(res.headers.get('x-injetado')).toBeNull()
      expect(cd.split('filename="')[1]!.split('"')[0]).not.toContain('"')
    })

    it('exige sessão (401) e evidência inexistente retorna 404', async () => {
      const a = await achado()
      const e = (await (await enviar(analista, a, 'a.txt', TXT)).json()) as Evidencia
      expect((await t.requisitar(`/api/evidencias/${e.id}/download`)).status).toBe(401)
      expect(
        (
          await t.requisitar('/api/evidencias/00000000-0000-4000-8000-000000000000/download', {
            cookie: dev.cookie,
          })
        ).status,
      ).toBe(404)
    })
  })

  describe('remoção', () => {
    it('autor desenvolvedor remove a própria; outro desenvolvedor recebe 403', async () => {
      const a = await achado({ responsavelId: dev.usuario.id })
      const e = (await (await enviar(dev, a, 'log.txt', TXT)).json()) as Evidencia
      expect(
        (
          await t.requisitar(`/api/evidencias/${e.id}`, {
            metodo: 'DELETE',
            cookie: outroDev.cookie,
          })
        ).status,
      ).toBe(403)
      expect(
        (await t.requisitar(`/api/evidencias/${e.id}`, { metodo: 'DELETE', cookie: dev.cookie }))
          .status,
      ).toBe(204)
    })

    it('analista remove; arquivo sai do disco e o histórico registra', async () => {
      const a = await achado()
      const e = (await (await enviar(analista, a, 'tela.png', PNG)).json()) as Evidencia
      const [linha] = await t.db.select().from(evidencias).where(eq(evidencias.id, e.id))
      const res = await t.requisitar(`/api/evidencias/${e.id}`, {
        metodo: 'DELETE',
        cookie: analista.cookie,
      })
      expect(res.status).toBe(204)
      expect(await readdir(t.diretorioEvidencias)).not.toContain(linha!.nomeArmazenado)
      expect(
        (await t.requisitar(`/api/evidencias/${e.id}/download`, { cookie: analista.cookie }))
          .status,
      ).toBe(404)
      const eventos = await t.db
        .select()
        .from(eventosHistorico)
        .where(eq(eventosHistorico.achadoId, a.id))
      expect(eventos.find((x) => x.tipo === 'EvidenciaRemovida')).toMatchObject({
        valorAnterior: 'tela.png',
      })
    })

    it('desenvolvedor não remove evidência de outra pessoa mesmo sendo o responsável', async () => {
      const a = await achado({ responsavelId: dev.usuario.id })
      const e = (await (await enviar(analista, a, 'tela.png', PNG)).json()) as Evidencia
      expect(
        (await t.requisitar(`/api/evidencias/${e.id}`, { metodo: 'DELETE', cookie: dev.cookie }))
          .status,
      ).toBe(403)
    })
  })

  it('o detalhe informa se o usuário pode anexar', async () => {
    const a = await achado({ responsavelId: dev.usuario.id })
    const ver = async (s: Sessao) =>
      (
        (await (
          await t.requisitar(`/api/achados/${a.id}`, { cookie: s.cookie })
        ).json()) as AchadoResposta
      ).acoes as unknown as {
        anexarEvidencia: boolean
      }
    expect((await ver(dev)).anexarEvidencia).toBe(true)
    expect((await ver(outroDev)).anexarEvidencia).toBe(false)
    expect((await ver(analista)).anexarEvidencia).toBe(true)
  })
})
