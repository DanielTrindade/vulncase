import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router'
import { esquemaProjeto, type FormularioProjeto } from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useProjeto, useSalvarProjeto, type Projeto } from '../../api/projetos'
import { useResponsaveis } from '../../api/usuarios'
import { useUsuario } from '../../auth/sessao'
import { Campo } from '../../componentes/campo'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { aplicarErrosApi } from '../../componentes/formulario'

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
      navegar(`/projetos/${salvo.id}`)
    } catch (err) {
      setErroGeral(aplicarErrosApi(err, setError, CAMPOS))
    }
  })

  if (projeto?.arquivado) {
    return <div className="alerta alerta--aviso">Projeto arquivado não pode ser editado.</div>
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>{projeto ? `Editar ${projeto.nome}` : 'Novo projeto'}</h1>
      </div>
      <form className="cartao formulario" onSubmit={(e) => void aoEnviar(e)} noValidate>
        {erroGeral && (
          <div className="alerta alerta--erro" role="alert">
            {erroGeral}
          </div>
        )}
        <div className="linha-campos">
          <Campo
            rotulo="Prefixo"
            erro={errors.prefixo?.message}
            ajuda={
              prefixoBloqueado
                ? 'O prefixo não pode mais ser alterado: o projeto já tem achados.'
                : 'De 2 a 5 letras. Usado no código dos achados, ex.: WEB-0007.'
            }
            obrigatorio
          >
            <input
              className="mono"
              maxLength={5}
              autoComplete="off"
              readOnly={prefixoBloqueado}
              style={{ textTransform: 'uppercase' }}
              {...register('prefixo')}
            />
          </Campo>
          <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
            <input maxLength={120} {...register('nome')} />
          </Campo>
        </div>
        <Campo rotulo="Responsável técnico" erro={errors.responsavelTecnicoId?.message} obrigatorio>
          <select {...register('responsavelTecnicoId')} disabled={responsaveis.isPending}>
            {responsaveis.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo="Descrição"
          erro={errors.descricao?.message}
          ajuda="Escopo e contexto da análise."
        >
          <textarea maxLength={4000} rows={5} {...register('descricao')} />
        </Campo>
        <div className="acoes">
          <button type="submit" className="botao botao--primario" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <Link to={projeto ? `/projetos/${projeto.id}` : '/projetos'} className="botao">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}
