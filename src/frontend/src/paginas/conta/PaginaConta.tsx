import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaTrocarSenha, ROTULOS_PAPEL, SENHA_MINIMO } from '@vulncase/compartilhado'
import { z } from 'zod'
import { useTrocarSenha } from '../../api/usuarios'
import { useUsuario } from '../../auth/sessao'
import { Campo } from '../../componentes/campo'
import { aplicarErrosApi } from '../../componentes/formulario'

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
  const [resultado, setResultado] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(
    null,
  )
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
    setResultado(null)
    try {
      await trocar.mutateAsync({ senhaAtual, novaSenha })
      reset()
      setResultado({
        tipo: 'sucesso',
        texto: 'Senha alterada. As sessões abertas em outros dispositivos foram encerradas.',
      })
    } catch (err) {
      setResultado({
        tipo: 'erro',
        texto: aplicarErrosApi(err, setError, ['senhaAtual', 'novaSenha']),
      })
    }
  })

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Minha conta</h1>
        </div>
      </div>
      <div className="grade grade--2">
        <div className="cartao">
          <h2>Dados</h2>
          <dl className="lista-dados">
            <dt>Nome</dt>
            <dd>{usuario.nome}</dd>
            <dt>E-mail</dt>
            <dd>{usuario.email}</dd>
            <dt>Papel</dt>
            <dd>{ROTULOS_PAPEL[usuario.papel]}</dd>
          </dl>
        </div>
        <form className="cartao formulario" onSubmit={(e) => void aoEnviar(e)} noValidate>
          <h2>Trocar senha</h2>
          {resultado && (
            <div
              className={`alerta alerta--${resultado.tipo}`}
              role={resultado.tipo === 'erro' ? 'alert' : 'status'}
            >
              {resultado.texto}
            </div>
          )}
          <Campo rotulo="Senha atual" erro={errors.senhaAtual?.message} obrigatorio>
            <input type="password" autoComplete="current-password" {...register('senhaAtual')} />
          </Campo>
          <Campo
            rotulo="Nova senha"
            erro={errors.novaSenha?.message}
            ajuda={`Mínimo de ${SENHA_MINIMO} caracteres.`}
            obrigatorio
          >
            <input type="password" autoComplete="new-password" {...register('novaSenha')} />
          </Campo>
          <Campo rotulo="Confirme a nova senha" erro={errors.confirmacao?.message} obrigatorio>
            <input type="password" autoComplete="new-password" {...register('confirmacao')} />
          </Campo>
          <div className="acoes">
            <button type="submit" className="botao botao--primario" disabled={trocar.isPending}>
              {trocar.isPending ? 'Salvando…' : 'Trocar senha'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
