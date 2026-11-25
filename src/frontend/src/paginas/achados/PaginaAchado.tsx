import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import {
  CheckIcon,
  ExternalLinkIcon,
  PencilIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { ROTULOS_ORIGEM, ROTULOS_STATUS, type StatusAchado } from '@vulncase/compartilhado'
import { useAchado, type Achado } from '@/api/achados'
import { formatarData, formatarDataHora } from '@/componentes/datas'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { SeloSeveridade, SeloStatus, SeloVencido } from '@/componentes/selos'
import { Alert, AlertDescription, AlertTitle } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'
import { DialogoTransicao } from './DialogoTransicao'
import { Evidencias } from './Evidencias'
import { Historico } from './Historico'
import { Responsavel } from './Responsavel'

type Acao = Achado['acoes']['transicoes'][number]

/** Destinos que avançam o achado no ciclo: viram o botão principal. */
const AVANCO: Partial<Record<StatusAchado, StatusAchado>> = {
  Aberto: 'EmCorrecao',
  EmCorrecao: 'AguardandoVerificacao',
  AguardandoVerificacao: 'Corrigido',
}

const ETAPAS: StatusAchado[] = ['Aberto', 'EmCorrecao', 'AguardandoVerificacao']

/**
 * Ciclo de vida do achado como sequência de etapas (o conteúdo é de fato uma sequência,
 * Tabela 7 do documento 03). A última etapa mostra o encerramento real.
 */
function CicloDoAchado({ status }: { status: StatusAchado }) {
  const encerrado = !ETAPAS.includes(status)
  const indiceAtual = encerrado ? 3 : ETAPAS.indexOf(status)
  const etapas = [
    ...ETAPAS.map((s) => ROTULOS_STATUS[s]),
    encerrado ? ROTULOS_STATUS[status] : 'Encerrado',
  ]
  return (
    <ol aria-label="Ciclo de correção" className="mb-6 grid grid-cols-4 gap-2">
      {etapas.map((rotulo, i) => {
        const feito = i < indiceAtual
        const atual = i === indiceAtual
        return (
          <li key={rotulo} aria-current={atual ? 'step' : undefined} className="min-w-0">
            <div
              className={cn(
                'h-1 rounded-full',
                feito || atual ? 'bg-primary' : 'bg-border',
                atual && !encerrado && 'bg-primary/60',
              )}
            />
            <div
              className={cn(
                'mt-2 flex items-center gap-1.5 truncate text-[13px]',
                atual
                  ? 'font-semibold text-foreground'
                  : feito
                    ? 'text-foreground'
                    : 'text-muted-foreground',
              )}
            >
              {feito && <CheckIcon className="size-3.5 shrink-0 text-primary" />}
              {rotulo}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Bloco de texto cadastrado: sempre como texto, nunca como HTML (RNF09). */
function Texto({
  titulo,
  children,
  mono = false,
}: {
  titulo: string
  children: string | null
  mono?: boolean
}) {
  if (!children) return null
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold">{titulo}</h3>
      <p
        className={cn(
          'texto-pre max-w-[75ch] text-[15px] leading-relaxed',
          mono && 'font-mono text-[13px]',
        )}
      >
        {children}
      </p>
    </div>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function PaginaAchado() {
  const { id } = useParams()
  const achado = useAchado(id)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [conflito, setConflito] = useState(false)

  if (achado.isPending) return <Carregando />
  if (achado.isError) return <MensagemErro erro={achado.error} />
  const a = achado.data
  const destinoPrincipal = AVANCO[a.status]

  async function recarregar() {
    await achado.refetch()
    setConflito(false)
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/projetos/${a.projeto.id}`} className="hover:underline">
              {a.projeto.nome}
            </Link>
            <span aria-hidden>/</span>
            <span className="font-mono" data-testid="codigo-achado">
              {a.codigo}
            </span>
          </div>
          <h1 className="titulo-achado max-w-[60ch] text-[26px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">
            {a.titulo}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SeloSeveridade severidade={a.severidade} />
            <SeloStatus status={a.status} />
            {a.vencido && <SeloVencido />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="acoes-achado">
          {a.acoes.editar && (
            <Button asChild variant="ghost">
              <Link to={`/achados/${a.id}/editar`}>
                <PencilIcon />
                Editar
              </Link>
            </Button>
          )}
          {a.acoes.transicoes.map((t) => (
            <Button
              key={t.destino}
              variant={t.destino === destinoPrincipal ? 'default' : 'outline'}
              onClick={() => setAcao(t)}
            >
              {t.rotulo}
            </Button>
          ))}
        </div>
      </header>

      {conflito && (
        <Alert className="mb-5">
          <TriangleAlertIcon />
          <AlertTitle>Outra pessoa alterou este achado</AlertTitle>
          <AlertDescription>
            <p>Recarregue para ver a versão atual antes de tentar de novo.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void recarregar()}>
              <RotateCcwIcon />
              Recarregar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CicloDoAchado status={a.status} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-5">
          <section className="grid gap-5 rounded-lg border bg-card p-5 md:p-6">
            <Texto titulo="Descrição">{a.descricao}</Texto>
            <Texto titulo="Impacto">{a.impacto}</Texto>
            <Texto titulo="Passos de reprodução" mono>
              {a.passosReproducao}
            </Texto>
            <Texto titulo="Correção proposta">{a.correcaoProposta}</Texto>
          </section>
          <Evidencias achado={a} />
          <section className="rounded-lg border bg-card p-5 md:p-6">
            <h2 className="mb-4 text-base font-semibold">Histórico e comentários</h2>
            <Historico achadoId={a.id} podeComentar={a.acoes.comentar} />
          </section>
        </div>

        <aside className="grid gap-5 lg:sticky lg:top-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Responsável</h2>
            <Responsavel
              key={`${a.versao}-${a.responsavel?.id ?? ''}`}
              achado={a}
              aoConflito={() => setConflito(true)}
            />
          </section>
          <section className="rounded-lg border bg-card p-5">
            <dl className="grid gap-4">
              <Item rotulo="Data-limite">
                <span className="tabular-nums">{formatarData(a.dataLimite)}</span>
                {a.dataLimiteManual && (
                  <span className="block text-xs text-muted-foreground">Ajustada manualmente</span>
                )}
              </Item>
              {a.ativo && (
                <Item rotulo="Ativo">
                  {a.ativo.nome}
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {a.ativo.identificador}
                  </span>
                </Item>
              )}
              <Item rotulo="Localização">
                <span className="font-mono text-[13px] [overflow-wrap:anywhere]">
                  {a.localizacao}
                </span>
              </Item>
              <Item rotulo="Origem">{ROTULOS_ORIGEM[a.origem]}</Item>
              <Item rotulo="Categoria OWASP">
                {a.categoriaOwasp
                  ? `${a.categoriaOwasp.codigo}:${a.categoriaOwasp.versao} ${a.categoriaOwasp.nome}`
                  : 'Não classificado'}
              </Item>
              {(a.cweId || a.cveId || a.notaCvss !== null) && (
                <Item rotulo="Referências">
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {a.cweId && (
                      <a
                        href={`https://cwe.mitre.org/data/definitions/${a.cweId}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[13px] text-primary hover:underline"
                      >
                        CWE-{a.cweId}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                    {a.cveId && <span className="font-mono text-[13px]">{a.cveId}</span>}
                    {a.notaCvss !== null && (
                      <span className="text-[13px]">CVSS {a.notaCvss.toFixed(1)}</span>
                    )}
                  </span>
                </Item>
              )}
            </dl>
          </section>
          <section className="rounded-lg border bg-card p-5">
            <dl className="grid gap-4">
              <Item rotulo="Registrado por">{a.registradoPor.nome}</Item>
              <Item rotulo="Registrado em">{formatarDataHora(a.criadoEm)}</Item>
              <Item rotulo="Atualizado em">{formatarDataHora(a.atualizadoEm)}</Item>
              {a.encerradoEm && (
                <Item rotulo="Encerrado em">{formatarDataHora(a.encerradoEm)}</Item>
              )}
            </dl>
          </section>
        </aside>
      </div>

      <DialogoTransicao
        achado={a}
        acao={acao}
        aoFechar={() => setAcao(null)}
        aoConflito={() => setConflito(true)}
      />
    </>
  )
}
