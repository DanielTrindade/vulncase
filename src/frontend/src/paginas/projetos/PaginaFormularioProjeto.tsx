import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { CircleAlertIcon } from 'lucide-react'
import { esquemaProjeto, type FormularioProjeto } from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useProjeto, useSalvarProjeto, type Projeto } from '@/api/projetos'
import { useResponsaveis } from '@/api/usuarios'
import { useUsuario } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { Campo } from '@/componentes/campo'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { aplicarErrosApi } from '@/componentes/formulario'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { FieldGroup } from '@/componentes/ui/field'
import { Input } from '@/componentes/ui/input'
import { NativeSelect, NativeSelectOption } from '@/componentes/ui/native-select'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'

const CAMPOS = ['prefixo', 'nome', 'descricao', 'responsavelTecnicoId'] as const

export function PaginaFormularioProjeto() {
  const { id } = useParams()
  const projeto = useProjeto(id)
  if (id && projeto.isPending) return <Carregando />
  if (id && projeto.isError) return <MensagemErro erro={projeto.error} />
  return <Formulario projeto={projeto.data} />
}

function Formulario({ projeto }: { projeto: Projeto | undefined }) {
  const eu = useUsuario()
  const navegar = useNavigate()
  const salvar = useSalvarProjeto()
  const responsaveis = useResponsaveis()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const prefixoBloqueado = projeto !== undefined && !projeto.prefixoEditavel

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormularioProjeto, unknown, z.output<typeof esquemaProjeto>>({
    resolver: zodResolver(esquemaProjeto),
    defaultValues: {
      prefixo: projeto?.prefixo ?? '',
      nome: projeto?.nome ?? '',
      descricao: projeto?.descricao ?? '',
      responsavelTecnicoId: projeto?.responsavelTecnico.id ?? eu.id,
    },
  })

  const aoEnviar = handleSubmit(async (dados) => {
    setErroGeral(null)
    try {
      const salvo = await salvar.mutateAsync({ id: projeto?.id, dados })
      toast.success(projeto ? 'Alterações salvas' : `Projeto ${salvo.nome} criado`)
      navegar(`/projetos/${salvo.id}`)
    } catch (err) {
      setErroGeral(aplicarErrosApi(err, setError, CAMPOS))
    }
  })

  if (projeto?.arquivado) {
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertDescription>Projeto arquivado não pode ser editado.</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <CabecalhoPagina
        titulo={projeto ? `Editar ${projeto.nome}` : 'Novo projeto'}
        descricao={
          projeto ? undefined : 'O prefixo identifica os achados do projeto, como WEB-0007.'
        }
      />
      <form
        className="max-w-2xl rounded-lg border bg-card p-6"
        onSubmit={(e) => void aoEnviar(e)}
        noValidate
      >
        <FieldGroup className="gap-5">
          {erroGeral && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{erroGeral}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
            <Campo
              rotulo="Prefixo"
              erro={errors.prefixo?.message}
              ajuda={prefixoBloqueado ? 'Fixo: o projeto já tem achados.' : 'De 2 a 5 letras.'}
              obrigatorio
            >
              <Input
                className="font-mono uppercase"
                maxLength={5}
                autoComplete="off"
                readOnly={prefixoBloqueado}
                {...register('prefixo')}
              />
            </Campo>
            <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
              <Input maxLength={120} {...register('nome')} />
            </Campo>
          </div>
          <Campo
            rotulo="Responsável técnico"
            erro={errors.responsavelTecnicoId?.message}
            obrigatorio
          >
            <NativeSelect disabled={responsaveis.isPending} {...register('responsavelTecnicoId')}>
              {responsaveis.data?.map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  {u.nome}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Campo>
          <Campo
            rotulo="Descrição"
            erro={errors.descricao?.message}
            ajuda="Escopo e contexto da análise."
          >
            <Textarea maxLength={4000} rows={5} {...register('descricao')} />
          </Campo>
          <div className="flex gap-2">
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending && <Spinner />}
              {projeto ? 'Salvar alterações' : 'Criar projeto'}
            </Button>
            <Button asChild variant="outline">
              <Link to={projeto ? `/projetos/${projeto.id}` : '/projetos'}>Cancelar</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </>
  )
}
