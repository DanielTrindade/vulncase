import { usePainelGeral } from '../../api/painel'
import { useUsuario } from '../../auth/sessao'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { Painel } from '../../componentes/painel'

/** Painel geral (RF28): tela inicial após a entrada. */
export function PaginaPainel() {
  const usuario = useUsuario()
  const painel = usePainelGeral()
  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Painel geral</h1>
          <p className="cabecalho-pagina__sub">
            {painel.data
              ? `Olá, ${usuario.nome}. Indicadores de ${painel.data.projetosAtivos} projeto(s) ativo(s).`
              : `Olá, ${usuario.nome}.`}
          </p>
        </div>
      </div>
      {painel.isPending ? (
        <Carregando />
      ) : painel.isError ? (
        <MensagemErro erro={painel.error} />
      ) : (
        <Painel dados={painel.data} />
      )}
    </section>
  )
}
