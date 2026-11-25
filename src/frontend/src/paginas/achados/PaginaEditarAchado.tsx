import { useParams } from 'react-router'
import { useAchado } from '../../api/achados'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { FormularioAchado } from './FormularioAchado'

export function PaginaEditarAchado() {
  const { id } = useParams()
  const achado = useAchado(id)
  if (achado.isPending) return <Carregando />
  if (achado.isError) return <MensagemErro erro={achado.error} />
  const a = achado.data
  if (!a.acoes.editar) {
    return (
      <div className="alerta alerta--aviso">
        Este achado não pode ser editado
        {a.encerradoEm ? ' porque está encerrado. Reabra-o primeiro.' : '.'}
      </div>
    )
  }
  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>
            Editar <span className="mono">{a.codigo}</span>
          </h1>
          <p className="cabecalho-pagina__sub">{a.projeto.nome}</p>
        </div>
      </div>
      <FormularioAchado
        key={a.versao}
        achado={a}
        projetoId={a.projeto.id}
        aoRecarregar={async () => (await achado.refetch()).data}
      />
    </section>
  )
}
