import { Link } from 'react-router'
import { ArrowUpRightIcon, CalendarClockIcon, UserRoundXIcon } from 'lucide-react'
import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_NAO_ENCERRADOS,
  type StatusAchado,
} from '@vulncase/compartilhado'
import type { Indicadores } from '@/api/painel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/componentes/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/componentes/ui/tooltip'
import { cn } from '@/lib/utils'
import { Painel } from './cabecalho'
import { formatarData } from './datas'
import { Vazio } from './estado'
import { BORDA_SEVERIDADE, COR_SEVERIDADE, SeloSeveridade, SeloStatus, SeloVencido } from './selos'

/** Monta a URL da lista de achados com o filtro do indicador (UC09, passo 3). */
export function urlLista(
  projetoId: string | undefined,
  filtros: Record<string, string | readonly string[]>,
) {
  const p = new URLSearchParams()
  if (projetoId) p.set('projetoId', projetoId)
  for (const [k, v] of Object.entries(filtros))
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, x)
  return `/achados?${p.toString()}`
}

/**
 * Faixa de severidade: uma única barra segmentada com os achados abertos de cada
 * severidade (parte do todo). É o elemento memorável do painel e o único com animação
 * de entrada (docs/09, seção 4).
 */
function FaixaSeveridade({ dados, projetoId }: { dados: Indicadores; projetoId?: string }) {
  const abertos = dados.abertosPorSeveridade
  const total = dados.totalAbertos
  const presentes = SEVERIDADES.filter((s) => abertos[s] > 0)

  return (
    <section aria-labelledby="titulo-faixa" className="rounded-lg border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-faixa" className="text-base font-semibold">
          Achados abertos por severidade
        </h2>
        <p className="text-sm text-muted-foreground">
          <span
            className="text-[26px] font-semibold text-foreground tabular-nums"
            data-testid="total-abertos"
          >
            {total}
          </span>{' '}
          {total === 1 ? 'aberto' : 'abertos'} de{' '}
          <span data-testid="total-registrados">{dados.total}</span> registrados
        </p>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-md bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum achado aberto no momento.
        </p>
      ) : (
        <div
          className="faixa-revela mt-4 flex h-12 w-full gap-[2px] overflow-hidden rounded-md"
          role="list"
        >
          {presentes.map((s) => (
            <Tooltip key={s}>
              <TooltipTrigger asChild>
                <Link
                  role="listitem"
                  to={urlLista(projetoId, { severidade: s, status: STATUS_NAO_ENCERRADOS })}
                  aria-label={`${ROTULOS_SEVERIDADE[s]}: ${abertos[s]} abertos`}
                  data-segmento={s}
                  className={cn(
                    'h-full min-w-2 outline-none transition-[filter] duration-150 hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                    COR_SEVERIDADE[s],
                  )}
                  // flex-grow proporcional à contagem; aplicado via CSSOM (permitido pela CSP).
                  style={{ flexGrow: abertos[s] }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {ROTULOS_SEVERIDADE[s]}: {abertos[s]} {abertos[s] === 1 ? 'aberto' : 'abertos'} (
                {Math.round((abertos[s] / total) * 100)}%)
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Legenda sempre presente, com valores (identidade nunca só pela cor). */}
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {SEVERIDADES.map((s) => (
          <li key={s}>
            <Link
              to={urlLista(projetoId, { severidade: s, status: STATUS_NAO_ENCERRADOS })}
              className="rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <SeloSeveridade severidade={s} quantidade={abertos[s]} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const CICLO: { status: StatusAchado[]; rotulo: string }[] = [
  { status: ['Aberto'], rotulo: ROTULOS_STATUS.Aberto },
  { status: ['EmCorrecao'], rotulo: ROTULOS_STATUS.EmCorrecao },
  { status: ['AguardandoVerificacao'], rotulo: ROTULOS_STATUS.AguardandoVerificacao },
  { status: ['Corrigido', 'FalsoPositivo', 'RiscoAceito'], rotulo: 'Encerrados' },
]

/** Ciclo de vida: contagem em cada etapa da sequência (Tabela 7 do documento 03). */
function CicloDeVida({ dados, projetoId }: { dados: Indicadores; projetoId?: string }) {
  return (
    <Painel titulo="Ciclo de correção">
      <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
        {CICLO.map((etapa, i) => {
          const qtd = etapa.status.reduce((a, s) => a + dados.porStatus[s], 0)
          return (
            <li key={etapa.rotulo} className="bg-card">
              <Link
                to={urlLista(projetoId, { status: etapa.status })}
                className="block h-full p-4 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <span className="text-xs text-muted-foreground">Etapa {i + 1}</span>
                <span className="mt-0.5 block text-sm font-medium">{etapa.rotulo}</span>
                <span
                  className="mt-2 block text-2xl font-semibold tabular-nums"
                  data-etapa={etapa.rotulo}
                >
                  {qtd}
                </span>
                {etapa.status.length > 1 && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {plural(dados.porStatus.Corrigido, 'corrigido', 'corrigidos')},{' '}
                    {plural(dados.porStatus.FalsoPositivo, 'falso positivo', 'falsos positivos')} e{' '}
                    {dados.porStatus.RiscoAceito} com risco aceito
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>
    </Painel>
  )
}

/** Pendências que pedem ação, no lugar de cartões de número grande (docs/09, Tabela 1). */
function PrecisaDeAtencao({ dados, projetoId }: { dados: Indicadores; projetoId?: string }) {
  const itens = [
    {
      icone: CalendarClockIcon,
      qtd: dados.vencidos,
      texto: dados.vencidos === 1 ? 'achado vencido' : 'achados vencidos',
      detalhe: 'A data-limite passou e o achado continua aberto.',
      url: urlLista(projetoId, { vencido: 'true' }),
      id: 'vencidos',
    },
    {
      icone: UserRoundXIcon,
      qtd: dados.semResponsavel,
      texto: dados.semResponsavel === 1 ? 'aberto sem responsável' : 'abertos sem responsável',
      detalhe: 'Ninguém foi designado para a correção.',
      url: urlLista(projetoId, { status: STATUS_NAO_ENCERRADOS, semResponsavel: 'true' }),
      id: 'sem-responsavel',
    },
  ]
  return (
    <Painel titulo="Precisa de atenção">
      <ul className="divide-y">
        {itens.map(({ icone: Icone, ...i }) => (
          <li key={i.id}>
            <Link
              to={i.url}
              data-pendencia={i.id}
              className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-3 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md',
                  i.qtd > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <Icone className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">
                  <span
                    className={cn('font-semibold tabular-nums', i.qtd > 0 && 'text-destructive')}
                  >
                    {i.qtd}
                  </span>{' '}
                  {i.texto}
                </span>
                <span className="block text-xs text-muted-foreground">{i.detalhe}</span>
              </span>
              <ArrowUpRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Painel>
  )
}

function MaisGraves({ dados, projetoId }: { dados: Indicadores; projetoId?: string }) {
  return (
    <Painel
      titulo="Abertos mais graves"
      acoes={
        <Link
          to={urlLista(projetoId, { status: STATUS_NAO_ENCERRADOS, ordenarPor: 'severidade' })}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todos
        </Link>
      }
    >
      {dados.maisGraves.length === 0 ? (
        <Vazio titulo="Nenhum achado aberto" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Data-limite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.maisGraves.map((a) => (
              <TableRow key={a.id} className={cn('border-l-[3px]', BORDA_SEVERIDADE[a.severidade])}>
                <TableCell className="font-mono text-[13px]">
                  <Link to={`/achados/${a.id}`} className="text-primary hover:underline">
                    {a.codigo}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[320px] truncate">{a.titulo}</TableCell>
                <TableCell>
                  <SeloSeveridade severidade={a.severidade} />
                </TableCell>
                <TableCell>
                  <SeloStatus status={a.status} />
                </TableCell>
                <TableCell>
                  {a.responsavel?.nome ?? (
                    <span className="text-muted-foreground">Sem responsável</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatarData(a.dataLimite)} {a.vencido && <SeloVencido className="ml-1" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Painel>
  )
}

/** Indicadores do UC09; todo indicador leva à lista de achados filtrada. */
export function PainelIndicadores({
  dados,
  projetoId,
}: {
  dados: Indicadores
  projetoId?: string
}) {
  return (
    // minmax(0, …): a tabela larga rola no próprio contêiner em vez de alargar a página.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <FaixaSeveridade dados={dados} projetoId={projetoId} />
      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CicloDeVida dados={dados} projetoId={projetoId} />
        <PrecisaDeAtencao dados={dados} projetoId={projetoId} />
      </div>
      <MaisGraves dados={dados} projetoId={projetoId} />
    </div>
  )
}
