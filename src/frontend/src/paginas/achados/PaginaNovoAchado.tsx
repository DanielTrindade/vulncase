import { Link, useParams } from 'react-router'
import { CircleAlertIcon } from 'lucide-react'
import { useProjeto } from '@/api/projetos'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { FormularioAchado } from './FormularioAchado'

export function PaginaNovoAchado() {
  const { id } = useParams()
  const projeto = useProjeto(id)
  if (projeto.isPending) return <Carregando />
  if (projeto.isError) return <MensagemErro erro={projeto.error} />
  if (projeto.data.arquivado) {
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertDescription>Projeto arquivado não aceita novos achados.</AlertDescription>
      </Alert>
    )
  }
  return (
    <>
      <CabecalhoPagina
        antes={
          <Link to={`/projetos/${projeto.data.id}`} className="hover:underline">
            {projeto.data.nome}
          </Link>
        }
        titulo="Novo achado"
        descricao={`O código será gerado no projeto ${projeto.data.prefixo}.`}
      />
      <FormularioAchado projetoId={projeto.data.id} />
    </>
  )
}
