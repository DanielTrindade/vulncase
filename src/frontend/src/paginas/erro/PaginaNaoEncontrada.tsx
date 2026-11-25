import { Link } from 'react-router'

export function PaginaNaoEncontrada() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/">Voltar ao painel</Link>
      </p>
    </section>
  )
}
