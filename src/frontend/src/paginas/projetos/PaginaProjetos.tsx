import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { SEVERIDADES } from '@vulncase/compartilhado'
import { mensagemDeErro } from '../../api/cliente'
import { useArquivarProjeto, useProjetos, type Projeto } from '../../api/projetos'
import { useSessao } from '../../auth/sessao'
import { DialogoConfirmacao } from '../../componentes/dialogo'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'
import { SeloSeveridade } from '../../componentes/selos'

export function PaginaProjetos() {
  const { temPapel } = useSessao()
  const podeGerenciar = temPapel('Analista', 'Administrador')
  const [params, setParams] = useSearchParams()
  const arquivados = params.get('arquivados') === 'true'
  const projetos = useProjetos(arquivados)
  const arquivar = useArquivarProjeto()
  const [alvo, setAlvo] = useState<Projeto | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  function trocarAba(arq: boolean) {
    setMensagem(null)
    setParams(arq ? { arquivados: 'true' } : {}, { replace: true })
  }

  function confirmarArquivamento() {
    if (!alvo) return
    arquivar.mutate(alvo.id, {
      onSuccess: (p) => {
        setMensagem(`Projeto ${p.nome} arquivado.`)
        setAlvo(null)
      },
    })
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Projetos</h1>
          <p className="cabecalho-pagina__sub">Achados abertos por severidade em cada projeto.</p>
        </div>
        {podeGerenciar && (
          <Link to="/projetos/novo" className="botao botao--primario">
            Novo projeto
          </Link>
        )}
      </div>

      <div className="abas" role="tablist">
        <button
          type="button"
          role="tab"
          className="abas__item"
          aria-selected={!arquivados}
          onClick={() => trocarAba(false)}
        >
          Ativos
        </button>
        <button
          type="button"
          role="tab"
          className="abas__item"
          aria-selected={arquivados}
          onClick={() => trocarAba(true)}
        >
          Arquivados
        </button>
      </div>

      {mensagem && (
        <div className="alerta alerta--sucesso" role="status">
          {mensagem}
        </div>
      )}

      {projetos.isPending ? (
        <Carregando />
      ) : projetos.isError ? (
        <MensagemErro erro={projetos.error} />
      ) : projetos.data.length === 0 ? (
        <Vazio>{arquivados ? 'Nenhum projeto arquivado.' : 'Nenhum projeto ativo.'}</Vazio>
      ) : (
        <div className="tabela-contorno">
          <table className="tabela">
            <thead>
              <tr>
                <th>Prefixo</th>
                <th>Projeto</th>
                <th>Responsável técnico</th>
                <th>Abertos por severidade</th>
                <th className="numero">Total</th>
                {podeGerenciar && !arquivados && <th className="tabela__acao">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {projetos.data.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.prefixo}</td>
                  <td>
                    <Link to={`/projetos/${p.id}`}>{p.nome}</Link>
                  </td>
                  <td>{p.responsavelTecnico.nome}</td>
                  <td>
                    <div className="acoes">
                      {SEVERIDADES.filter((s) => p.abertosPorSeveridade[s] > 0).map((s) => (
                        <SeloSeveridade
                          key={s}
                          severidade={s}
                          quantidade={p.abertosPorSeveridade[s]}
                        />
                      ))}
                      {p.totalAbertos === 0 && <span className="texto-suave">—</span>}
                    </div>
                  </td>
                  <td className="numero">{p.totalAbertos}</td>
                  {podeGerenciar && !arquivados && (
                    <td className="tabela__acao">
                      <div className="acoes" style={{ justifyContent: 'flex-end' }}>
                        <Link to={`/projetos/${p.id}/editar`} className="botao botao--pequeno">
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="botao botao--pequeno"
                          onClick={() => {
                            arquivar.reset()
                            setAlvo(p)
                          }}
                        >
                          Arquivar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo="Arquivar projeto"
        mensagem={
          <>
            O projeto <strong>{alvo?.nome}</strong> deixará de aceitar novos achados e ficará oculto
            da lista padrão. Só é possível arquivar um projeto sem achados abertos, em correção ou
            aguardando verificação.
          </>
        }
        rotuloConfirmar="Arquivar"
        ocupado={arquivar.isPending}
        erro={arquivar.isError ? mensagemDeErro(arquivar.error) : null}
        aoConfirmar={confirmarArquivamento}
        aoCancelar={() => setAlvo(null)}
      />
    </section>
  )
}
