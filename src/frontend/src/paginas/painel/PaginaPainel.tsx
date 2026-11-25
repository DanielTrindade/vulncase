import { usePainelGeral } from '@/api/painel'
import { useUsuario } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { PainelIndicadores } from '@/componentes/painel'

/** Painel geral (RF28): tela inicial após a entrada. */
export function PaginaPainel() {
  const usuario = useUsuario()
  const painel = usePainelGeral()
  const primeiroNome = usuario.nome.split(' ')[0]
  return (
    <>
      <CabecalhoPagina
        titulo="Painel"
        descricao={
          painel.data
            ? `Olá, ${primeiroNome}. Visão de ${painel.data.projetosAtivos} ${painel.data.projetosAtivos === 1 ? 'projeto ativo' : 'projetos ativos'}.`
            : `Olá, ${primeiroNome}.`
        }
      />
      {painel.isPending ? (
        <Carregando />
      ) : painel.isError ? (
        <MensagemErro erro={painel.error} />
      ) : (
        <PainelIndicadores dados={painel.data} />
      )}
    </>
  )
}
