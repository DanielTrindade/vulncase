import { Link } from 'react-router'
import { Vazio } from '@/componentes/estado'
import { Button } from '@/componentes/ui/button'

export function PaginaNaoEncontrada() {
  return (
    <Vazio
      titulo="Página não encontrada"
      acao={
        <Button asChild>
          <Link to="/">Ir para o painel</Link>
        </Button>
      }
    >
      O endereço não existe ou você não tem acesso a ele.
    </Vazio>
  )
}
