import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { esquemaCriarUsuario, PAPEIS, ROTULOS_PAPEL, SENHA_MINIMO } from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useCriarUsuario } from '../../api/usuarios'
import { Campo } from '../../componentes/campo'
import { aplicarErrosApi } from '../../componentes/formulario'

type Formulario = z.input<typeof esquemaCriarUsuario>
const CAMPOS = ['nome', 'email', 'papel', 'senha'] as const

export function FormularioNovoUsuario({
  aoCancelar,
  aoCriar,
}: {
  aoCancelar: () => void
  aoCriar: (nome: string) => void
}) {
  const criar = useCriarUsuario()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Formulario, unknown, z.output<typeof esquemaCriarUsuario>>({
    resolver: zodResolver(esquemaCriarUsuario),
    defaultValues: { nome: '', email: '', papel: 'Desenvolvedor', senha: '' },
  })

  const aoEnviar = handleSubmit(async (dados) => {
    setErroGeral(null)
    try {
      const u = await criar.mutateAsync(dados)
      aoCriar(u.nome)
    } catch (err) {
      setErroGeral(aplicarErrosApi(err, setError, CAMPOS))
    }
  })

  return (
    <form className="cartao formulario" onSubmit={(e) => void aoEnviar(e)} noValidate>
      <h2>Novo usuário</h2>
      {erroGeral && (
        <div className="alerta alerta--erro" role="alert">
          {erroGeral}
        </div>
      )}
      <div className="linha-campos">
        <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
          <input autoComplete="off" {...register('nome')} />
        </Campo>
        <Campo rotulo="E-mail" erro={errors.email?.message} obrigatorio>
          <input type="email" autoComplete="off" {...register('email')} />
        </Campo>
      </div>
      <div className="linha-campos">
        <Campo rotulo="Papel" erro={errors.papel?.message} obrigatorio>
          <select {...register('papel')}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PAPEL[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo="Senha inicial"
          erro={errors.senha?.message}
          ajuda={`Mínimo de ${SENHA_MINIMO} caracteres. Informe-a ao usuário por um canal seguro.`}
          obrigatorio
        >
          <input type="password" autoComplete="new-password" {...register('senha')} />
        </Campo>
      </div>
      <div className="acoes">
        <button type="submit" className="botao botao--primario" disabled={criar.isPending}>
          {criar.isPending ? 'Cadastrando…' : 'Cadastrar'}
        </button>
        <button type="button" className="botao" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
