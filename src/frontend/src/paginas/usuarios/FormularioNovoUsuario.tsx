import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlertIcon } from 'lucide-react'
import { esquemaCriarUsuario, PAPEIS, ROTULOS_PAPEL, SENHA_MINIMO } from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useCriarUsuario } from '@/api/usuarios'
import { Campo } from '@/componentes/campo'
import { aplicarErrosApi } from '@/componentes/formulario'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { DialogFooter } from '@/componentes/ui/dialog'
import { Input } from '@/componentes/ui/input'
import { NativeSelect, NativeSelectOption } from '@/componentes/ui/native-select'
import { Spinner } from '@/componentes/ui/spinner'

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
    <form className="grid gap-5" onSubmit={(e) => void aoEnviar(e)} noValidate>
      {erroGeral && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{erroGeral}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
        <Input autoComplete="off" {...register('nome')} />
      </Campo>
      <Campo rotulo="E-mail" erro={errors.email?.message} obrigatorio>
        <Input type="email" autoComplete="off" {...register('email')} />
      </Campo>
      <Campo rotulo="Papel" erro={errors.papel?.message} obrigatorio>
        <NativeSelect {...register('papel')}>
          {PAPEIS.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {ROTULOS_PAPEL[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Campo
        rotulo="Senha inicial"
        erro={errors.senha?.message}
        ajuda={`Mínimo de ${SENHA_MINIMO} caracteres. Informe-a por um canal seguro.`}
        obrigatorio
      >
        <Input type="password" autoComplete="new-password" {...register('senha')} />
      </Campo>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={criar.isPending}>
          {criar.isPending && <Spinner />}
          Cadastrar usuário
        </Button>
      </DialogFooter>
    </form>
  )
}
