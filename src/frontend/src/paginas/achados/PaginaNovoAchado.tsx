import { useParams } from 'react-router'
import { useProjeto } from '../../api/projetos'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { FormularioAchado } from './FormularioAchado'

export function PaginaNovoAchado() {
  const { id } = useParams()
  const projeto = useProjeto(id)
  if (projeto.isPending) return <Carregando />
  if (projeto.isError) return <MensagemErro erro={projeto.error} />
  if (projeto.data.arquivado) {
    return <div className="alerta alerta--aviso">Projeto arquivado não aceita novos achados.</div>
  }
  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Novo achado</h1>
          <p className="cabecalho-pagina__sub">
            Projeto <span className="mono">{projeto.data.prefixo}</span> — {projeto.data.nome}
          </p>
        </div>
      </div>
      <FormularioAchado projetoId={projeto.data.id} />
    </section>
  )
}
