import { mensagemDeErro } from '../api/cliente'

export function Carregando({ tela = false }: { tela?: boolean }) {
  return (
    <div className={tela ? 'carregando carregando--tela' : 'carregando'} role="status">
      <span className="carregando__indicador" aria-hidden="true" />
      Carregando…
    </div>
  )
}

export function MensagemErro({ erro, titulo }: { erro: unknown; titulo?: string }) {
  return (
    <div className="alerta alerta--erro" role="alert">
      {titulo && <strong>{titulo} </strong>}
      {mensagemDeErro(erro)}
    </div>
  )
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="vazio">{children}</p>
}
