import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ArchiveIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { ROTULOS_SEVERIDADE, SEVERIDADES } from '@vulncase/compartilhado'
import { mensagemDeErro } from '@/api/cliente'
import { useArquivarProjeto, useProjetos, type Projeto } from '@/api/projetos'
import { useSessao } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { DialogoConfirmacao } from '@/componentes/dialogo'
import { Carregando, MensagemErro, Vazio } from '@/componentes/estado'
import { COR_SEVERIDADE } from '@/componentes/selos'
import { Button } from '@/componentes/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/componentes/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/componentes/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/componentes/ui/tooltip'
import { cn } from '@/lib/utils'

/** Mini faixa de severidade da linha do projeto (mesma linguagem do painel). */
function MiniFaixa({ projeto }: { projeto: Projeto }) {
  if (projeto.totalAbertos === 0)
    return <span className="text-sm text-muted-foreground">Nenhum aberto</span>
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-2 w-32 gap-px overflow-hidden rounded-full bg-muted" aria-hidden>
        {SEVERIDADES.filter((s) => projeto.abertosPorSeveridade[s] > 0).map((s) => (
          <span
            key={s}
            className={cn('h-full', COR_SEVERIDADE[s])}
            style={{ flexGrow: projeto.abertosPorSeveridade[s] }}
          />
        ))}
      </div>
      <span className="sr-only">
        {SEVERIDADES.filter((s) => projeto.abertosPorSeveridade[s] > 0)
          .map((s) => `${ROTULOS_SEVERIDADE[s]}: ${projeto.abertosPorSeveridade[s]}`)
          .join(', ')}
      </span>
    </div>
  )
}

export function PaginaProjetos() {
  const { temPapel } = useSessao()
  const podeGerenciar = temPapel('Analista', 'Administrador')
  const [params, setParams] = useSearchParams()
  const arquivados = params.get('arquivados') === 'true'
  const projetos = useProjetos(arquivados)
  const arquivar = useArquivarProjeto()
  const [alvo, setAlvo] = useState<Projeto | null>(null)

  function confirmarArquivamento() {
    if (!alvo) return
    arquivar.mutate(alvo.id, {
      onSuccess: (p) => {
        toast.success(`Projeto ${p.nome} arquivado`)
        setAlvo(null)
      },
    })
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Projetos"
        descricao="Cada projeto agrupa os achados de uma análise."
        acoes={
          podeGerenciar && (
            <Button asChild>
              <Link to="/projetos/novo">
                <PlusIcon />
                Novo projeto
              </Link>
            </Button>
          )
        }
      />

      <Tabs
        value={arquivados ? 'arquivados' : 'ativos'}
        onValueChange={(v) =>
          setParams(v === 'arquivados' ? { arquivados: 'true' } : {}, { replace: true })
        }
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      {projetos.isPending ? (
        <Carregando />
      ) : projetos.isError ? (
        <MensagemErro erro={projetos.error} />
      ) : projetos.data.length === 0 ? (
        <Vazio
          titulo={arquivados ? 'Nenhum projeto arquivado' : 'Nenhum projeto ativo'}
          acao={
            podeGerenciar && !arquivados ? (
              <Button asChild>
                <Link to="/projetos/novo">Criar o primeiro projeto</Link>
              </Button>
            ) : undefined
          }
        >
          {arquivados
            ? 'Projetos arquivados aparecem aqui.'
            : 'Crie um projeto para começar a registrar achados.'}
        </Vazio>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 pl-4">Prefixo</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Responsável técnico</TableHead>
                <TableHead>Abertos por severidade</TableHead>
                <TableHead className="text-right">Abertos</TableHead>
                {podeGerenciar && !arquivados && (
                  <TableHead className="w-24 pr-4 text-right">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projetos.data.map((p) => (
                <TableRow key={p.id} data-projeto={p.prefixo}>
                  <TableCell className="pl-4 font-mono text-[13px] text-muted-foreground">
                    {p.prefixo}
                  </TableCell>
                  <TableCell>
                    <Link to={`/projetos/${p.id}`} className="font-medium hover:underline">
                      {p.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.responsavelTecnico.nome}
                  </TableCell>
                  <TableCell>
                    <MiniFaixa projeto={p} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {p.totalAbertos}
                  </TableCell>
                  {podeGerenciar && !arquivados && (
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              asChild
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${p.nome}`}
                            >
                              <Link to={`/projetos/${p.id}/editar`}>
                                <PencilIcon />
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Arquivar ${p.nome}`}
                              onClick={() => {
                                arquivar.reset()
                                setAlvo(p)
                              }}
                            >
                              <ArchiveIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Arquivar</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo={`Arquivar ${alvo?.nome ?? 'projeto'}?`}
        mensagem={
          <>
            O projeto deixa de aceitar novos achados e sai da lista padrão. Só é possível arquivar
            quando nenhum achado está aberto, em correção ou aguardando verificação.
          </>
        }
        rotuloConfirmar="Arquivar projeto"
        ocupado={arquivar.isPending}
        erro={arquivar.isError ? mensagemDeErro(arquivar.error) : null}
        aoConfirmar={confirmarArquivamento}
        aoCancelar={() => setAlvo(null)}
      />
    </>
  )
}
