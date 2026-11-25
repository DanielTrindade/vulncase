import { Link, useParams } from 'react-router'
import { DownloadIcon, FileTextIcon, ListChecksIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { usePainelProjeto } from '@/api/painel'
import { useProjeto } from '@/api/projetos'
import { useSessao } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { PainelIndicadores } from '@/componentes/painel'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { Ativos } from './Ativos'

export function PaginaProjeto() {
  const { id } = useParams()
  const { temPapel } = useSessao()
  const projeto = useProjeto(id)
  const painel = usePainelProjeto(id ?? '')
  if (projeto.isPending) return <Carregando />
  if (projeto.isError) return <MensagemErro erro={projeto.error} />
  const p = projeto.data
  const podeGerenciar = temPapel('Analista', 'Administrador') && !p.arquivado

  return (
    <>
      <CabecalhoPagina
        antes={
          <Link to="/projetos" className="hover:underline">
            Projetos
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-lg text-primary">
              {p.prefixo}
            </span>
            {p.nome}
            {p.arquivado && <Badge variant="secondary">Arquivado</Badge>}
          </span>
        }
        descricao={`Responsável técnico: ${p.responsavelTecnico.nome}`}
        acoes={
          <>
            <Button asChild variant="outline">
              <Link to={`/achados?projetoId=${p.id}`}>
                <ListChecksIcon />
                Ver achados
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/projetos/${p.id}/relatorio.csv`} download>
                <DownloadIcon />
                Exportar CSV
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/projetos/${p.id}/relatorio.pdf`} download>
                <FileTextIcon />
                Relatório PDF
              </a>
            </Button>
            {podeGerenciar && (
              <>
                <Button asChild variant="outline">
                  <Link to={`/projetos/${p.id}/editar`}>
                    <PencilIcon />
                    Editar
                  </Link>
                </Button>
                <Button asChild>
                  <Link to={`/projetos/${p.id}/achados/novo`}>
                    <PlusIcon />
                    Novo achado
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      {p.descricao && (
        <p className="texto-pre mb-6 max-w-[75ch] text-[15px] leading-relaxed text-muted-foreground">
          {p.descricao}
        </p>
      )}

      {painel.isPending ? (
        <Carregando />
      ) : painel.isError ? (
        <MensagemErro erro={painel.error} />
      ) : (
        <PainelIndicadores dados={painel.data} projetoId={p.id} />
      )}

      <div className="mt-5">
        <Ativos projetoId={p.id} podeGerenciar={podeGerenciar} />
      </div>
    </>
  )
}
