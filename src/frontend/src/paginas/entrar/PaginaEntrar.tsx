import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { CircleAlertIcon } from 'lucide-react'
import { ErroApi } from '@/api/cliente'
import { useSessao } from '@/auth/sessao'
import { Marca } from '@/componentes/marca'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/componentes/ui/field'
import { Input } from '@/componentes/ui/input'
import { Spinner } from '@/componentes/ui/spinner'

function mensagemEntrada(err: unknown): string {
  if (err instanceof ErroApi) {
    if (err.status === 429) {
      return 'Conta bloqueada por excesso de tentativas. Aguarde 15 minutos e tente de novo.'
    }
    if (err.status === 401 || err.status === 400) return 'E-mail ou senha incorretos.'
  }
  return 'Não foi possível entrar. Verifique a conexão e tente de novo.'
}

/** Escala de severidade usada como elemento gráfico da entrada (docs/09). */
const ESCALA = [
  { rotulo: 'Crítica', cor: 'bg-sev-critica', largura: 'w-full' },
  { rotulo: 'Alta', cor: 'bg-sev-alta', largura: 'w-[82%]' },
  { rotulo: 'Média', cor: 'bg-sev-media', largura: 'w-[64%]' },
  { rotulo: 'Baixa', cor: 'bg-sev-baixa', largura: 'w-[46%]' },
  { rotulo: 'Informativa', cor: 'bg-sev-informativa', largura: 'w-[28%]' },
]

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
    if (!email.trim() || !senha) return setErro('Informe o e-mail e a senha.')
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
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <Marca className="text-lg text-primary-foreground" />
        <div className="max-w-md">
          <p className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em]">
            Cada achado registrado, priorizado e acompanhado até a correção.
          </p>
          <div aria-hidden className="mt-10 space-y-2.5">
            {ESCALA.map((s) => (
              <div key={s.rotulo} className="grid grid-cols-[6rem_1fr] items-center gap-4">
                <span className="text-sm text-primary-foreground/75">{s.rotulo}</span>
                <span
                  className={`block h-2 rounded-full ${s.cor} ${s.largura} ring-1 ring-primary-foreground/20`}
                />
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/70">Projeto Integrador ICC330, UFAM</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <form className="w-full max-w-sm" onSubmit={(e) => void aoEnviar(e)} noValidate>
          <Marca className="mb-10 text-lg lg:hidden" />
          <h1 className="text-[26px] font-semibold tracking-[-0.01em]">Entrar</h1>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">
            Use o e-mail e a senha cadastrados pelo administrador.
          </p>
          <FieldGroup className="gap-5">
            {erro && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="senha">Senha</FieldLabel>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={enviando}>
              {enviando && <Spinner />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </Button>
          </FieldGroup>
        </form>
      </section>
    </div>
  )
}
