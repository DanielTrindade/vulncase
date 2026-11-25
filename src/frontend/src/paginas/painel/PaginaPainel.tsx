import { useUsuario } from '../../auth/sessao'

export function PaginaPainel() {
  const usuario = useUsuario()
  return (
    <section>
      <h1>Painel</h1>
      <p>Bem-vindo, {usuario.nome}.</p>
    </section>
  )
}
