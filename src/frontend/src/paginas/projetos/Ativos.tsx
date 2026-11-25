import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import {
  AMBIENTES,
  esquemaAtivo,
  ROTULOS_AMBIENTE,
  ROTULOS_TIPO_ATIVO,
  TIPOS_ATIVO,
  type FormularioAtivo,
} from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useAtivos, useCriarAtivo } from '../../api/projetos'
import { Campo } from '../../componentes/campo'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'
import { aplicarErrosApi } from '../../componentes/formulario'

function NovoAtivo({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const criar = useCriarAtivo(projetoId)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormularioAtivo, unknown, z.output<typeof esquemaAtivo>>({
    resolver: zodResolver(esquemaAtivo),
    defaultValues: { nome: '', tipo: 'AplicacaoWeb', identificador: '', ambiente: 'Laboratorio' },
  })
  const aoEnviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      await criar.mutateAsync(dados)
      aoFechar()
    } catch (err) {
      setErro(aplicarErrosApi(err, setError, ['nome', 'tipo', 'identificador', 'ambiente']))
    }
  })
  return (
    <form
      className="formulario formulario--largo envio-evidencia"
      onSubmit={(e) => void aoEnviar(e)}
      noValidate
    >
      {erro && (
        <div className="alerta alerta--erro" role="alert">
          {erro}
        </div>
      )}
      <div className="linha-campos">
        <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
          <input maxLength={120} {...register('nome')} />
        </Campo>
        <Campo rotulo="Tipo" erro={errors.tipo?.message} obrigatorio>
          <select {...register('tipo')}>
            {TIPOS_ATIVO.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_TIPO_ATIVO[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo="Identificador"
          erro={errors.identificador?.message}
          ajuda="URL, IP, host ou repositório."
          obrigatorio
        >
          <input maxLength={500} className="mono" {...register('identificador')} />
        </Campo>
        <Campo rotulo="Ambiente" erro={errors.ambiente?.message} obrigatorio>
          <select {...register('ambiente')}>
            {AMBIENTES.map((a) => (
              <option key={a} value={a}>
                {ROTULOS_AMBIENTE[a]}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="acoes">
        <button type="submit" className="botao botao--primario" disabled={criar.isPending}>
          Cadastrar ativo
        </button>
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Ativos do projeto (RF11), na página do projeto. */
export function Ativos({
  projetoId,
  podeGerenciar,
}: {
  projetoId: string
  podeGerenciar: boolean
}) {
  const ativos = useAtivos(projetoId)
  const [criando, setCriando] = useState(false)
  return (
    <div className="cartao">
      <div className="cabecalho-pagina" style={{ marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Ativos</h2>
        {podeGerenciar && !criando && (
          <button type="button" className="botao botao--pequeno" onClick={() => setCriando(true)}>
            Novo ativo
          </button>
        )}
      </div>
      {ativos.isPending ? (
        <Carregando />
      ) : ativos.isError ? (
        <MensagemErro erro={ativos.error} />
      ) : ativos.data.length === 0 ? (
        <Vazio>Nenhum ativo cadastrado.</Vazio>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Identificador</th>
              <th>Ambiente</th>
              <th className="tabela__acao">Achados</th>
            </tr>
          </thead>
          <tbody>
            {ativos.data.map((a) => (
              <tr key={a.id}>
                <td>{a.nome}</td>
                <td>{ROTULOS_TIPO_ATIVO[a.tipo]}</td>
                <td className="mono quebra">{a.identificador}</td>
                <td>{ROTULOS_AMBIENTE[a.ambiente]}</td>
                <td className="tabela__acao">
                  <Link to={`/achados?projetoId=${projetoId}&ativoId=${a.id}`}>Ver achados</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {criando && <NovoAtivo projetoId={projetoId} aoFechar={() => setCriando(false)} />}
    </div>
  )
}
