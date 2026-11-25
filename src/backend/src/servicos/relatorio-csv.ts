import { asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { ROTULOS_ORIGEM, ROTULOS_SEVERIDADE, ROTULOS_STATUS } from '@vulncase/compartilhado'
import type { BancoDados } from '../db/cliente.js'
import { achados, categoriasOwasp, projetos, usuarios } from '../db/schema.js'
import { estaVencido } from '../dominio/achado.js'
import { RecursoNaoEncontradoError } from '../dominio/erros.js'
import { gerarCsv } from '../infra/csv.js'
import { hojeUtc } from './achados.js'

const responsavel = alias(usuarios, 'responsavel')
const registradoPor = alias(usuarios, 'registrado_por')

const CABECALHO = [
  'Código',
  'Título',
  'Severidade',
  'Status',
  'Origem',
  'Categoria OWASP',
  'CWE',
  'CVE',
  'Nota CVSS',
  'Localização',
  'Responsável',
  'Registrado por',
  'Data-limite',
  'Vencido',
  'Registrado em',
  'Encerrado em',
  'Descrição',
  'Impacto',
  'Passos de reprodução',
  'Correção proposta',
]

const iso = (d: Date | null) => (d ? d.toISOString() : null)

/** RF29: todos os achados do projeto em CSV, ordenados pelo código. */
export async function gerarRelatorioCsv(db: BancoDados, projetoId: string) {
  const [projeto] = await db.select().from(projetos).where(eq(projetos.id, projetoId))
  if (!projeto) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
  const hoje = hojeUtc()
  const linhas = await db
    .select({
      a: achados,
      categoria: {
        codigo: categoriasOwasp.codigo,
        versao: categoriasOwasp.versao,
        nome: categoriasOwasp.nome,
      },
      responsavel: responsavel.nome,
      registradoPor: registradoPor.nome,
    })
    .from(achados)
    .innerJoin(registradoPor, eq(registradoPor.id, achados.registradoPorId))
    .leftJoin(responsavel, eq(responsavel.id, achados.responsavelId))
    .leftJoin(categoriasOwasp, eq(categoriasOwasp.id, achados.categoriaOwaspId))
    .where(eq(achados.projetoId, projetoId))
    .orderBy(asc(achados.codigo))

  const csv = gerarCsv(
    CABECALHO,
    linhas.map(({ a, categoria, responsavel: resp, registradoPor: autor }) => [
      a.codigo,
      a.titulo,
      ROTULOS_SEVERIDADE[a.severidade],
      ROTULOS_STATUS[a.status],
      ROTULOS_ORIGEM[a.origem],
      categoria ? `${categoria.codigo}:${categoria.versao} ${categoria.nome}` : null,
      a.cweId ? `CWE-${a.cweId}` : null,
      a.cveId,
      a.notaCvss,
      a.localizacao,
      resp,
      autor,
      a.dataLimite,
      estaVencido(a, hoje) ? 'Sim' : 'Não',
      iso(a.criadoEm),
      iso(a.encerradoEm),
      a.descricao,
      a.impacto,
      a.passosReproducao,
      a.correcaoProposta,
    ]),
  )
  return { csv, nomeArquivo: `${projeto.prefixo}-achados-${hoje}.csv`, total: linhas.length }
}
