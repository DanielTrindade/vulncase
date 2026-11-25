import { Link, useParams } from 'react-router'
import { SEVERIDADES } from '@vulncase/compartilhado'
import { useProjeto } from '../../api/projetos'
import { useSessao } from '../../auth/sessao'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { SeloSeveridade } from '../../componentes/selos'

export function PaginaProjeto() {
  const { id } = useParams()
  const { temPapel } = useSessao()
  const projeto = useProjeto(id)
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
        <div className="cartao">
          <p className="texto-pre">{p.descricao}</p>
        </div>
      )}

      <div className="cartao">
        <h2>Achados abertos por severidade</h2>
        <div className="acoes">
          {SEVERIDADES.map((s) => (
            <SeloSeveridade key={s} severidade={s} quantidade={p.abertosPorSeveridade[s]} />
          ))}
        </div>
      </div>
    </section>
  )
}
