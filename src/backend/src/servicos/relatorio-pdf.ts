import { createRequire } from 'node:module'
import path from 'node:path'
import { asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import PDFDocument from 'pdfkit'
import {
  estaEncerrado,
  ROTULOS_ORIGEM,
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_ACHADO,
} from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { achados, categoriasOwasp, projetos, usuarios } from '../db/schema.js'
import { estaVencido } from '../dominio/achado.js'
import { hojeUtc } from './achados.js'
import { painelProjeto } from './painel.js'

/**
 * Relatório do projeto em PDF (RF30). O documento é desenhado por código com o
 * pdfkit: nenhum HTML ou marcação fornecida pelo usuário é interpretada, e todo
 * texto cadastrado é escrito como texto simples. A fonte DejaVu cobre os
 * caracteres do português e símbolos comuns.
 */
const require = createRequire(import.meta.url)
const PASTA_FONTES = path.join(
  path.dirname(require.resolve('dejavu-fonts-ttf/package.json')),
  'ttf',
)
const FONTE = path.join(PASTA_FONTES, 'DejaVuSans.ttf')
const FONTE_NEGRITO = path.join(PASTA_FONTES, 'DejaVuSans-Bold.ttf')
const FONTE_MONO = path.join(PASTA_FONTES, 'DejaVuSansMono.ttf')

const MARGEM = 50
const COR_TEXTO = '#1c2430'
const COR_SUAVE = '#5b6675'
const COR_LINHA = '#dde1e7'
const COR_FUNDO = '#f0f2f5'

const responsavel = alias(usuarios, 'responsavel')

type Doc = PDFKit.PDFDocument

function largura(doc: Doc) {
  return doc.page.width - MARGEM * 2
}

function garantirEspaco(doc: Doc, altura: number) {
  if (doc.y + altura > doc.page.height - MARGEM - 20) doc.addPage()
}

/** Título de seção; não fica sozinho no fim da página. */
function titulo(doc: Doc, texto: string, espacoMinimo = 90) {
  garantirEspaco(doc, espacoMinimo)
  doc.moveDown(0.8).font('negrito').fontSize(14).fillColor(COR_TEXTO).text(texto, MARGEM)
  const y = doc.y + 3
  doc
    .moveTo(MARGEM, y)
    .lineTo(MARGEM + largura(doc), y)
    .lineWidth(1)
    .strokeColor(COR_LINHA)
    .stroke()
  doc.y = y + 8
}

/** Tabela com quebra de linha nas células (nada é truncado) e quebra de página. */
function tabela(doc: Doc, colunas: { titulo: string; peso: number }[], linhas: string[][]) {
  const total = colunas.reduce((s, c) => s + c.peso, 0)
  const larguras = colunas.map((c) => (c.peso / total) * largura(doc))
  const pad = 4
  const alturaLinha = (celulas: string[], fonte: string) =>
    Math.max(
      ...celulas.map((t, i) =>
        doc
          .font(fonte)
          .fontSize(8.5)
          .heightOfString(t || '—', { width: larguras[i]! - pad * 2 }),
      ),
    ) +
    pad * 2

  const desenhar = (celulas: string[], fonte: string, fundo?: string) => {
    const h = alturaLinha(celulas, fonte)
    if (doc.y + h > doc.page.height - MARGEM - 20) {
      doc.addPage()
      desenharCabecalho()
    }
    const y = doc.y
    if (fundo) doc.rect(MARGEM, y, largura(doc), h).fill(fundo)
    let x = MARGEM
    celulas.forEach((t, i) => {
      doc
        .font(fonte)
        .fontSize(8.5)
        .fillColor(COR_TEXTO)
        .text(t || '—', x + pad, y + pad, { width: larguras[i]! - pad * 2 })
      x += larguras[i]!
    })
    doc
      .moveTo(MARGEM, y + h)
      .lineTo(MARGEM + largura(doc), y + h)
      .lineWidth(0.5)
      .strokeColor(COR_LINHA)
      .stroke()
    doc.x = MARGEM
    doc.y = y + h
  }
  const desenharCabecalho = () =>
    desenhar(
      colunas.map((c) => c.titulo),
      'negrito',
      COR_FUNDO,
    )

  desenharCabecalho()
  for (const l of linhas) desenhar(l, 'normal')
}

function campo(doc: Doc, rotulo: string, valor: string | null | undefined, mono = false) {
  if (!valor) return
  garantirEspaco(doc, 30)
  doc.font('negrito').fontSize(9).fillColor(COR_SUAVE).text(rotulo, MARGEM)
  doc
    .font(mono ? 'mono' : 'normal')
    .fontSize(9.5)
    .fillColor(COR_TEXTO)
    .text(valor, MARGEM, doc.y, { width: largura(doc) })
  doc.moveDown(0.4)
}

const dataBr = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
const dataHoraBr = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Manaus',
  }).format(d)

export async function gerarRelatorioPdf(db: BancoDados, projetoId: string, usuario: UsuarioSessao) {
  const painel = await painelProjeto(db, projetoId)
  const { projeto } = painel
  const hoje = hojeUtc()
  const linhas = await db
    .select({
      a: achados,
      responsavel: responsavel.nome,
      categoria: {
        codigo: categoriasOwasp.codigo,
        versao: categoriasOwasp.versao,
        nome: categoriasOwasp.nome,
      },
    })
    .from(achados)
    .leftJoin(responsavel, eq(responsavel.id, achados.responsavelId))
    .leftJoin(categoriasOwasp, eq(categoriasOwasp.id, achados.categoriaOwaspId))
    .where(eq(achados.projetoId, projetoId))
    .orderBy(asc(achados.codigo))
  const [detalhesProjeto] = await db
    .select({ descricao: projetos.descricao })
    .from(projetos)
    .where(eq(projetos.id, projetoId))

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGEM,
    bufferPages: true,
    info: {
      Title: `Relatório de achados — ${projeto.nome}`,
      Author: 'VulnCase',
      Subject: `Projeto ${projeto.prefixo}`,
    },
  })
  doc.registerFont('normal', FONTE)
  doc.registerFont('negrito', FONTE_NEGRITO)
  doc.registerFont('mono', FONTE_MONO)

  const partes: Buffer[] = []
  doc.on('data', (b: Buffer) => partes.push(b))
  const fim = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))))

  // 1. Identificação
  doc.font('negrito').fontSize(20).fillColor(COR_TEXTO).text('Relatório de achados de segurança')
  doc.font('normal').fontSize(12).fillColor(COR_SUAVE).text(`${projeto.prefixo} — ${projeto.nome}`)
  doc.moveDown(0.5)
  campo(doc, 'Descrição', detalhesProjeto?.descricao)
  campo(doc, 'Situação do projeto', projeto.arquivado ? 'Arquivado' : 'Ativo')
  campo(doc, 'Gerado em', `${dataHoraBr(new Date())} por ${usuario.nome}`)
  doc
    .font('normal')
    .fontSize(8.5)
    .fillColor(COR_SUAVE)
    .text(
      'Documento confidencial: contém detalhes de vulnerabilidades. Não compartilhe fora da equipe autorizada.',
      {
        width: largura(doc),
      },
    )

  // 2. Indicadores
  titulo(doc, 'Indicadores')
  tabela(
    doc,
    [
      { titulo: 'Total', peso: 1 },
      { titulo: 'Abertos', peso: 1 },
      { titulo: 'Abertos sem responsável', peso: 1.6 },
      { titulo: 'Vencidos', peso: 1 },
    ],
    [
      [
        String(painel.total),
        String(painel.totalAbertos),
        String(painel.semResponsavel),
        String(painel.vencidos),
      ],
    ],
  )
  doc.moveDown(0.6)
  tabela(
    doc,
    [
      { titulo: 'Severidade', peso: 2 },
      { titulo: 'Todos', peso: 1 },
      { titulo: 'Abertos', peso: 1 },
    ],
    SEVERIDADES.map((s) => [
      ROTULOS_SEVERIDADE[s],
      String(painel.porSeveridade[s]),
      String(painel.abertosPorSeveridade[s]),
    ]),
  )
  doc.moveDown(0.6)
  tabela(
    doc,
    [
      { titulo: 'Status', peso: 2 },
      { titulo: 'Achados', peso: 1 },
    ],
    STATUS_ACHADO.map((s) => [ROTULOS_STATUS[s], String(painel.porStatus[s])]),
  )

  // 3. Lista de achados
  titulo(doc, 'Achados')
  if (linhas.length === 0) {
    doc.font('normal').fontSize(10).fillColor(COR_SUAVE).text('Nenhum achado registrado.')
  } else {
    tabela(
      doc,
      [
        { titulo: 'Código', peso: 1.15 },
        { titulo: 'Título', peso: 3 },
        { titulo: 'Severidade', peso: 1.25 },
        { titulo: 'Status', peso: 1.45 },
        { titulo: 'Responsável', peso: 1.5 },
        { titulo: 'Data-limite', peso: 1.2 },
      ],
      linhas.map(({ a, responsavel: r }) => [
        a.codigo,
        a.titulo,
        ROTULOS_SEVERIDADE[a.severidade],
        ROTULOS_STATUS[a.status],
        r ?? '—',
        dataBr(a.dataLimite) + (estaVencido(a, hoje) ? ' (vencido)' : ''),
      ]),
    )
  }

  // 4. Detalhes dos abertos, do mais grave ao menos grave
  const peso: Record<string, number> = { Critica: 5, Alta: 4, Media: 3, Baixa: 2, Informativa: 1 }
  const abertos = linhas
    .filter(({ a }) => !estaEncerrado(a.status))
    .sort(
      (x, y) =>
        peso[y.a.severidade]! - peso[x.a.severidade]! || x.a.codigo.localeCompare(y.a.codigo),
    )
  titulo(doc, 'Detalhes dos achados abertos', 160)
  if (abertos.length === 0) {
    doc.font('normal').fontSize(10).fillColor(COR_SUAVE).text('Nenhum achado aberto.')
  }
  for (const { a, responsavel: r, categoria } of abertos) {
    garantirEspaco(doc, 80)
    doc
      .moveDown(0.4)
      .font('negrito')
      .fontSize(11)
      .fillColor(COR_TEXTO)
      .text(`${a.codigo} — ${a.titulo}`, MARGEM, doc.y, {
        width: largura(doc),
      })
    doc
      .font('normal')
      .fontSize(9)
      .fillColor(COR_SUAVE)
      .text(
        [
          ROTULOS_SEVERIDADE[a.severidade],
          ROTULOS_STATUS[a.status],
          ROTULOS_ORIGEM[a.origem],
          r ? `Responsável: ${r}` : 'Sem responsável',
          `Data-limite: ${dataBr(a.dataLimite)}`,
        ].join(' · '),
        { width: largura(doc) },
      )
    doc.moveDown(0.3)
    campo(doc, 'Localização', a.localizacao, true)
    campo(
      doc,
      'Classificação',
      [
        categoria ? `OWASP ${categoria.codigo}:${categoria.versao} ${categoria.nome}` : null,
        a.cweId ? `CWE-${a.cweId}` : null,
        a.cveId,
        a.notaCvss ? `CVSS ${a.notaCvss}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    )
    campo(doc, 'Descrição', a.descricao)
    campo(doc, 'Impacto', a.impacto)
    campo(doc, 'Passos de reprodução', a.passosReproducao, true)
    campo(doc, 'Correção proposta', a.correcaoProposta)
    const y = doc.y + 2
    doc
      .moveTo(MARGEM, y)
      .lineTo(MARGEM + largura(doc), y)
      .lineWidth(0.5)
      .strokeColor(COR_LINHA)
      .stroke()
    doc.y = y + 4
  }

  // Rodapé com numeração em todas as páginas.
  const paginas = doc.bufferedPageRange()
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i)
    // Sem margem inferior, o texto do rodapé não provoca uma página nova.
    doc.page.margins.bottom = 0
    const yRodape = doc.page.height - MARGEM + 10
    doc
      .font('normal')
      .fontSize(8)
      .fillColor(COR_SUAVE)
      .text(
        `VulnCase · ${projeto.prefixo} · ${hoje} · página ${i + 1} de ${paginas.count}`,
        MARGEM,
        yRodape,
        {
          width: largura(doc),
          align: 'center',
          lineBreak: false,
        },
      )
  }
  doc.end()
  return { pdf: await fim, nomeArquivo: `${projeto.prefixo}-relatorio-${hoje}.pdf` }
}
