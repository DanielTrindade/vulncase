import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_ACHADO,
  type CampoOrdenacao,
} from '@vulncase/compartilhado'
import { useAchados, useCategoriasOwasp } from '@/api/achados'
import { useAtivos, useProjetos } from '@/api/projetos'
import { useResponsaveis } from '@/api/usuarios'
import { useSessao, useUsuario } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { formatarData } from '@/componentes/datas'
import { Carregando, MensagemErro, Vazio } from '@/componentes/estado'
import {
  BORDA_SEVERIDADE,
  COR_SEVERIDADE,
  SeloSeveridade,
  SeloStatus,
  SeloVencido,
} from '@/componentes/selos'
import { Button } from '@/componentes/ui/button'
import { Checkbox } from '@/componentes/ui/checkbox'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/componentes/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/componentes/ui/table'
import { cn } from '@/lib/utils'
import { consultaDaUrl, ordenacaoDaUrl } from './filtros-url'

const TODOS = '__todos'

const ROTULOS_ORDENACAO: Record<CampoOrdenacao, string> = {
  criadoEm: 'Data de registro',
  severidade: 'Severidade',
  dataLimite: 'Data-limite',
}

/** Filtro de seleção única com rótulo visível (Select do Radix; não aceita valor vazio). */
function FiltroSelect({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  largura = 'w-[200px]',
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  opcoes: { valor: string; rotulo: ReactNode }[]
  largura?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-normal text-muted-foreground">{rotulo}</Label>
      <Select value={valor} onValueChange={aoMudar}>
        <SelectTrigger aria-label={rotulo} className={cn('bg-card', largura)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Botão de alternância usado nos filtros de severidade e status. */
function Alternancia({
  ativo,
  aoAlternar,
  children,
}: {
  ativo: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoAlternar}
      className={cn(
        'pressionavel inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        ativo
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** Campo de busca: só altera a URL ao enviar; recriado quando a URL muda (key). */
function CampoBusca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (texto: string) => void }) {
  const [busca, setBusca] = useState(inicial)
  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    aoBuscar(busca.trim())
  }
  return (
    <form onSubmit={aoEnviar} role="search" className="relative flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar por título ou código, ex.: WEB-0007"
        aria-label="Buscar por título ou código"
        maxLength={100}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="h-10 bg-card pl-9"
      />
    </form>
  )
}

export function PaginaAchados() {
  const usuario = useUsuario()
  const { temPapel } = useSessao()
  const gestor = temPapel('Analista', 'Administrador')
  const [params, setParams] = useSearchParams()
  const consulta = consultaDaUrl(params)
  const achados = useAchados(consulta)
  const projetos = useProjetos(false)
  const categorias = useCategoriasOwasp()
  const responsaveis = useResponsaveis(gestor)
  const ativos = useAtivos(params.get('projetoId') ?? undefined)
  const { campo, ordem } = ordenacaoDaUrl(params)

  /** Altera parâmetros da URL; qualquer filtro novo volta para a primeira página. */
  function alterar(mudancas: Record<string, string | string[] | null>, manterPagina = false) {
    const novo = new URLSearchParams(params)
    for (const [nome, valor] of Object.entries(mudancas)) {
      novo.delete(nome)
      if (valor === null) continue
      for (const v of Array.isArray(valor) ? valor : [valor])
        if (v !== '' && v !== TODOS) novo.append(nome, v)
    }
    if (!manterPagina) novo.delete('pagina')
    setParams(novo)
  }

  function alternar(nome: 'status' | 'severidade', valor: string) {
    const atuais = params.getAll(nome)
    alterar({
      [nome]: atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor],
    })
  }

  const meus = params.get('responsavelId') === usuario.id
  const temFiltro = [...params.keys()].some(
    (k) => !['ordenarPor', 'ordem', 'pagina', 'tamanhoPagina'].includes(k),
  )
  const valorResponsavel =
    params.get('semResponsavel') === 'true' ? '__sem' : (params.get('responsavelId') ?? TODOS)

  return (
    <>
      <CabecalhoPagina
        titulo="Achados"
        descricao={
          achados.data
            ? `${achados.data.total} ${achados.data.total === 1 ? 'achado encontrado' : 'achados encontrados'}`
            : 'Consulte e filtre os achados dos projetos ativos.'
        }
      />

      <section aria-label="Filtros" className="mb-5 grid gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CampoBusca
            key={params.get('busca') ?? ''}
            inicial={params.get('busca') ?? ''}
            aoBuscar={(texto) => alterar({ busca: texto || null })}
          />
          {temFiltro && (
            <Button variant="ghost" onClick={() => setParams({})}>
              <XIcon />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FiltroSelect
            rotulo="Projeto"
            valor={params.get('projetoId') ?? TODOS}
            aoMudar={(v) => alterar({ projetoId: v, ativoId: null })}
            largura="w-[240px]"
            opcoes={[
              { valor: TODOS, rotulo: 'Todos os projetos ativos' },
              ...(projetos.data ?? []).map((p) => ({
                valor: p.id,
                rotulo: (
                  <span>
                    <span className="font-mono text-muted-foreground">{p.prefixo}</span> {p.nome}
                  </span>
                ),
              })),
            ]}
          />
          {params.get('projetoId') && (ativos.data?.length ?? 0) > 0 && (
            <FiltroSelect
              rotulo="Ativo"
              valor={params.get('ativoId') ?? TODOS}
              aoMudar={(v) => alterar({ ativoId: v })}
              opcoes={[
                { valor: TODOS, rotulo: 'Todos' },
                ...(ativos.data ?? []).map((a) => ({ valor: a.id, rotulo: a.nome })),
              ]}
            />
          )}
          {gestor && (
            <FiltroSelect
              rotulo="Responsável"
              valor={valorResponsavel}
              aoMudar={(v) =>
                v === '__sem'
                  ? alterar({ responsavelId: null, semResponsavel: 'true' })
                  : alterar({ responsavelId: v, semResponsavel: null })
              }
              opcoes={[
                { valor: TODOS, rotulo: 'Qualquer' },
                { valor: '__sem', rotulo: 'Sem responsável' },
                ...(responsaveis.data ?? []).map((u) => ({ valor: u.id, rotulo: u.nome })),
              ]}
            />
          )}
          <FiltroSelect
            rotulo="Categoria OWASP"
            valor={params.get('categoriaOwaspId') ?? TODOS}
            aoMudar={(v) => alterar({ categoriaOwaspId: v })}
            largura="w-[260px]"
            opcoes={[
              { valor: TODOS, rotulo: 'Todas' },
              ...(categorias.data ?? []).map((c) => ({
                valor: String(c.id),
                rotulo: `${c.codigo}:${c.versao} ${c.nome}`,
              })),
            ]}
          />
          <FiltroSelect
            rotulo="Ordenar por"
            valor={`${campo}:${ordem}`}
            aoMudar={(v) => {
              const [c, o] = v.split(':')
              alterar({ ordenarPor: c ?? null, ordem: o ?? null }, true)
            }}
            opcoes={(Object.keys(ROTULOS_ORDENACAO) as CampoOrdenacao[]).flatMap((c) => [
              {
                valor: `${c}:desc`,
                rotulo: `${ROTULOS_ORDENACAO[c]}, ${c === 'severidade' ? 'mais grave primeiro' : 'mais recente primeiro'}`,
              },
              {
                valor: `${c}:asc`,
                rotulo: `${ROTULOS_ORDENACAO[c]}, ${c === 'severidade' ? 'menos grave primeiro' : 'mais antigo primeiro'}`,
              },
            ])}
            largura="w-[310px] max-w-full"
          />
          <div className="flex h-9 items-center gap-4 pb-px">
            {!gestor && (
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={meus}
                  onCheckedChange={() =>
                    alterar({ responsavelId: meus ? null : usuario.id, semResponsavel: null })
                  }
                />
                Somente atribuídos a mim
              </Label>
            )}
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={params.get('vencido') === 'true'}
                onCheckedChange={(v) => alterar({ vencido: v === true ? 'true' : null })}
              />
              Somente vencidos
            </Label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[88px_1fr] sm:items-center">
          <span className="text-xs text-muted-foreground">Severidade</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Severidade">
            {SEVERIDADES.map((s) => (
              <Alternancia
                key={s}
                ativo={params.getAll('severidade').includes(s)}
                aoAlternar={() => alternar('severidade', s)}
              >
                <span aria-hidden className={cn('size-2 rounded-[2px]', COR_SEVERIDADE[s])} />
                {ROTULOS_SEVERIDADE[s]}
              </Alternancia>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Status</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
            {STATUS_ACHADO.map((s) => (
              <Alternancia
                key={s}
                ativo={params.getAll('status').includes(s)}
                aoAlternar={() => alternar('status', s)}
              >
                {ROTULOS_STATUS[s]}
              </Alternancia>
            ))}
          </div>
        </div>
      </section>

      {achados.isPending ? (
        <Carregando />
      ) : achados.isError ? (
        <MensagemErro erro={achados.error} titulo="Filtros inválidos ou erro na consulta" />
      ) : achados.data.itens.length === 0 ? (
        <Vazio
          titulo="Nenhum achado com esses filtros"
          acao={
            temFiltro ? (
              <Button variant="outline" onClick={() => setParams({})}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        >
          Ajuste ou limpe os filtros para ver mais resultados.
        </Vazio>
      ) : (
        <>
          <div
            className={cn(
              'rounded-lg border bg-card transition-opacity duration-150',
              achados.isFetching && 'opacity-60',
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="pr-4">Data-limite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {achados.data.itens.map((a) => (
                  <TableRow
                    key={a.id}
                    data-codigo={a.codigo}
                    className={cn('border-l-[3px]', BORDA_SEVERIDADE[a.severidade])}
                  >
                    <TableCell className="pl-4 font-mono text-[13px]">
                      <Link to={`/achados/${a.id}`} className="text-primary hover:underline">
                        {a.codigo}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[380px]">
                      <Link
                        to={`/achados/${a.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {a.titulo}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.projeto.nome}
                      </span>
                    </TableCell>
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
                    <TableCell className="pr-4 whitespace-nowrap tabular-nums">
                      {formatarData(a.dataLimite)} {a.vencido && <SeloVencido className="ml-1" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <nav
            aria-label="Paginação"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
          >
            <span data-testid="paginacao">
              Página {achados.data.pagina} de {achados.data.totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={achados.data.pagina <= 1}
                onClick={() => alterar({ pagina: String(achados.data.pagina - 1) }, true)}
              >
                <ChevronLeftIcon />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={achados.data.pagina >= achados.data.totalPaginas}
                onClick={() => alterar({ pagina: String(achados.data.pagina + 1) }, true)}
              >
                Próxima
                <ChevronRightIcon />
              </Button>
            </div>
          </nav>
        </>
      )}
    </>
  )
}
