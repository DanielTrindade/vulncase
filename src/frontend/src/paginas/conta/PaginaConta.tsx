import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaTrocarSenha, ROTULOS_PAPEL, SENHA_MINIMO } from '@vulncase/compartilhado'
import { z } from 'zod'
import { toast } from 'sonner'
import { CircleAlertIcon } from 'lucide-react'
import { useTrocarSenha } from '@/api/usuarios'
import { useUsuario } from '@/auth/sessao'
import { CabecalhoPagina, Painel } from '@/componentes/cabecalho'
import { Campo } from '@/componentes/campo'
import { aplicarErrosApi } from '@/componentes/formulario'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Spinner } from '@/componentes/ui/spinner'

/** Confirmação é só usabilidade; a API recebe apenas senhaAtual e novaSenha. */
const esquemaFormulario = z
  .object({ senhaAtual: z.string(), novaSenha: z.string(), confirmacao: z.string() })
  .superRefine((v, ctx) => {
    const r = esquemaTrocarSenha.safeParse({ senhaAtual: v.senhaAtual, novaSenha: v.novaSenha })
    if (!r.success) {
      for (const i of r.error.issues) ctx.addIssue({ ...i, code: 'custom', message: i.message })
    }
    if (v.confirmacao !== v.novaSenha) {
      ctx.addIssue({ code: 'custom', path: ['confirmacao'], message: 'As senhas não conferem.' })
    }
  })
type Formulario = z.infer<typeof esquemaFormulario>

export function PaginaConta() {
  const usuario = useUsuario()
  const trocar = useTrocarSenha()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmacao: '' },
  })

  const aoEnviar = handleSubmit(async ({ senhaAtual, novaSenha }) => {
    setErro(null)
    try {
      await trocar.mutateAsync({ senhaAtual, novaSenha })
      reset()
      toast.success('Senha alterada', {
        description: 'As sessões abertas em outros dispositivos foram encerradas.',
      })
    } catch (err) {
      setErro(aplicarErrosApi(err, setError, ['senhaAtual', 'novaSenha']))
    }
  })

  return (
    <>
      <CabecalhoPagina titulo="Minha conta" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Painel titulo="Dados">
          <dl className="grid gap-4">
            {[
              ['Nome', usuario.nome],
              ['E-mail', usuario.email],
              ['Papel', ROTULOS_PAPEL[usuario.papel]],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd className="text-sm [overflow-wrap:anywhere]">{valor}</dd>
              </div>
            ))}
          </dl>
        </Painel>
        <Painel titulo="Trocar senha">
          <form className="grid gap-5" onSubmit={(e) => void aoEnviar(e)} noValidate>
            {erro && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <Campo rotulo="Senha atual" erro={errors.senhaAtual?.message} obrigatorio>
              <Input type="password" autoComplete="current-password" {...register('senhaAtual')} />
            </Campo>
            <Campo
              rotulo="Nova senha"
              erro={errors.novaSenha?.message}
              ajuda={`Mínimo de ${SENHA_MINIMO} caracteres.`}
              obrigatorio
            >
              <Input type="password" autoComplete="new-password" {...register('novaSenha')} />
            </Campo>
            <Campo rotulo="Confirme a nova senha" erro={errors.confirmacao?.message} obrigatorio>
              <Input type="password" autoComplete="new-password" {...register('confirmacao')} />
            </Campo>
            <div>
              <Button type="submit" disabled={trocar.isPending}>
                {trocar.isPending && <Spinner />}
                Trocar senha
              </Button>
            </div>
          </form>
        </Painel>
      </div>
    </>
  )
}
