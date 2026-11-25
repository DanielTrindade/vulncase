import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ErroApi } from '../../api/cliente'
import { useSessao } from '../../auth/sessao'

function mensagemEntrada(err: unknown): string {
  if (err instanceof ErroApi) {
    if (err.status === 429) {
      return 'Conta bloqueada temporariamente por excesso de tentativas. Aguarde 15 minutos e tente novamente.'
    }
    if (err.status === 401 || err.status === 400) return 'E-mail ou senha inválidos.'
  }
  return 'Não foi possível entrar. Verifique a conexão e tente novamente.'
}

export function PaginaEntrar() {
  const { usuario, entrar } = useSessao()
  const navegar = useNavigate()
  const local = useLocation()
  const destino = (local.state as { destino?: string } | null)?.destino ?? '/'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={destino} replace />

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await entrar(email, senha)
      navegar(destino, { replace: true })
    } catch (err) {
      setErro(mensagemEntrada(err))
      setSenha('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="entrada">
      <form className="entrada__cartao" onSubmit={(e) => void aoEnviar(e)} noValidate>
        <h1 className="entrada__titulo">
          <span className="marca__simbolo" aria-hidden="true">
            ◆
          </span>{' '}
          VulnCase
        </h1>
        <p className="entrada__subtitulo">Registro e acompanhamento de achados de segurança</p>

        {erro && (
          <div className="alerta alerta--erro" role="alert">
            {erro}
          </div>
        )}

        <label className="campo">
          <span className="campo__rotulo">E-mail</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="botao botao--primario botao--largo"
          disabled={enviando || !email || !senha}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
