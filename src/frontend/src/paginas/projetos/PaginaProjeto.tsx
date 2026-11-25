import { Link, useParams } from 'react-router'
import { usePainelProjeto } from '../../api/painel'
import { useProjeto } from '../../api/projetos'
import { useSessao } from '../../auth/sessao'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { Painel } from '../../componentes/painel'
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
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>
            <span className="mono texto-suave">{p.prefixo}</span> {p.nome}
          </h1>
          <p className="cabecalho-pagina__sub">
            Responsável técnico: {p.responsavelTecnico.nome}
            {p.arquivado && ' · Arquivado'}
          </p>
        </div>
        <div className="acoes">
          <Link to={`/achados?projetoId=${p.id}`} className="botao">
            Ver achados
          </Link>
          <a href={`/api/projetos/${p.id}/relatorio.csv`} className="botao" download>
            Exportar CSV
          </a>
          <a href={`/api/projetos/${p.id}/relatorio.pdf`} className="botao" download>
            Relatório PDF
          </a>
          {podeGerenciar && (
            <>
              <Link to={`/projetos/${p.id}/editar`} className="botao">
                Editar
              </Link>
              <Link to={`/projetos/${p.id}/achados/novo`} className="botao botao--primario">
                Novo achado
              </Link>
            </>
          )}
        </div>
      </div>

      {p.descricao && (
        <div className="cartao" style={{ marginBottom: '1rem' }}>
          <p className="texto-pre">{p.descricao}</p>
        </div>
      )}

      {painel.isPending ? (
        <Carregando />
      ) : painel.isError ? (
        <MensagemErro erro={painel.error} />
      ) : (
        <Painel dados={painel.data} projetoId={p.id} />
      )}
      <div style={{ marginTop: '1rem' }}>
        <Ativos projetoId={p.id} podeGerenciar={podeGerenciar} />
      </div>
    </section>
  )
}
