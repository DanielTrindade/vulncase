import { Link, useParams } from 'react-router'
import { CircleAlertIcon } from 'lucide-react'
import { useAchado } from '@/api/achados'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { FormularioAchado } from './FormularioAchado'

export function PaginaEditarAchado() {
  const { id } = useParams()
  const achado = useAchado(id)
  if (achado.isPending) return <Carregando />
  if (achado.isError) return <MensagemErro erro={achado.error} />
  const a = achado.data
  if (!a.acoes.editar) {
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertDescription>
          Este achado não pode ser editado
          {a.encerradoEm ? ' porque está encerrado. Reabra-o primeiro.' : '.'}
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <>
      <CabecalhoPagina
        antes={
          <Link to={`/achados/${a.id}`} className="font-mono hover:underline">
            {a.codigo}
          </Link>
        }
        titulo="Editar achado"
        descricao={a.projeto.nome}
      />
      <FormularioAchado
        key={a.versao}
        achado={a}
        projetoId={a.projeto.id}
        aoRecarregar={async () => (await achado.refetch()).data}
      />
    </>
  )
}
