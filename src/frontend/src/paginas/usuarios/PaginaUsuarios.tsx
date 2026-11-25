import { useState } from 'react'
import { PAPEIS, ROTULOS_PAPEL, type Papel } from '@vulncase/compartilhado'
import { mensagemDeErro } from '../../api/cliente'
import { useAlterarUsuario, useUsuarios, type UsuarioLista } from '../../api/usuarios'
import { useUsuario } from '../../auth/sessao'
import { DialogoConfirmacao } from '../../componentes/dialogo'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'
import { FormularioNovoUsuario } from './FormularioNovoUsuario'

function SeletorPapel({ usuario, desabilitado }: { usuario: UsuarioLista; desabilitado: boolean }) {
  const alterar = useAlterarUsuario()
  const [papel, setPapel] = useState<Papel>(usuario.papel)
  const mudou = papel !== usuario.papel
  return (
    <div className="acoes">
      <select
        aria-label={`Papel de ${usuario.nome}`}
        value={papel}
        disabled={desabilitado || alterar.isPending}
        onChange={(e) => setPapel(e.target.value as Papel)}
      >
        {PAPEIS.map((p) => (
          <option key={p} value={p}>
            {ROTULOS_PAPEL[p]}
          </option>
        ))}
      </select>
      {mudou && (
        <>
          <button
            type="button"
            className="botao botao--primario botao--pequeno"
            disabled={alterar.isPending}
            onClick={() => alterar.mutate({ id: usuario.id, dados: { papel } })}
          >
            Salvar
          </button>
          <button
            type="button"
            className="botao botao--pequeno"
            onClick={() => setPapel(usuario.papel)}
          >
            Desfazer
          </button>
        </>
      )}
      {alterar.isError && <span className="campo__erro">{mensagemDeErro(alterar.error)}</span>}
    </div>
  )
}

export function PaginaUsuarios() {
  const eu = useUsuario()
  const usuarios = useUsuarios()
  const alterar = useAlterarUsuario()
  const [criando, setCriando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<UsuarioLista | null>(null)

  function confirmarSituacao() {
    if (!alvo) return
    alterar.mutate(
      { id: alvo.id, dados: { ativo: !alvo.ativo } },
      {
        onSuccess: (u) => {
          setMensagem(`${u.nome} foi ${u.ativo ? 'reativado' : 'desativado'}.`)
          setAlvo(null)
        },
      },
    )
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Usuários</h1>
          <p className="cabecalho-pagina__sub">Cadastro, papel e situação das contas.</p>
        </div>
        {!criando && (
          <button type="button" className="botao botao--primario" onClick={() => setCriando(true)}>
            Novo usuário
          </button>
        )}
      </div>

      {mensagem && (
        <div className="alerta alerta--sucesso" role="status">
          {mensagem}
        </div>
      )}

      {criando && (
        <FormularioNovoUsuario
          aoCancelar={() => setCriando(false)}
          aoCriar={(nome) => {
            setCriando(false)
            setMensagem(`Usuário ${nome} cadastrado.`)
          }}
        />
      )}

      {usuarios.isPending ? (
        <Carregando />
      ) : usuarios.isError ? (
        <MensagemErro erro={usuarios.error} />
      ) : usuarios.data.length === 0 ? (
        <Vazio>Nenhum usuário cadastrado.</Vazio>
      ) : (
        <div className="tabela-contorno">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Situação</th>
                <th className="tabela__acao">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.data.map((u) => {
                const proprio = u.id === eu.id
                return (
                  <tr key={u.id}>
                    <td>
                      {u.nome}
                      {proprio && <span className="texto-suave"> (você)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <SeletorPapel
                        key={`${u.id}-${u.papel}`}
                        usuario={u}
                        desabilitado={proprio || !u.ativo}
                      />
                    </td>
                    <td>
                      {u.ativo ? (
                        <span className="selo selo--neutro">Ativo</span>
                      ) : (
                        <span className="selo selo--inativo">Inativo</span>
                      )}
                    </td>
                    <td className="tabela__acao">
                      {!proprio && (
                        <button
                          type="button"
                          className={
                            u.ativo ? 'botao botao--perigo botao--pequeno' : 'botao botao--pequeno'
                          }
                          onClick={() => {
                            alterar.reset()
                            setAlvo(u)
                          }}
                        >
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo={alvo?.ativo ? 'Desativar usuário' : 'Reativar usuário'}
        mensagem={
          alvo?.ativo ? (
            <>
              <strong>{alvo.nome}</strong> perderá o acesso imediatamente. Os achados abertos
              atribuídos a essa pessoa ficarão sem responsável, e os que estiverem em correção
              voltarão para Aberto.
            </>
          ) : (
            <>
              <strong>{alvo?.nome}</strong> voltará a poder entrar no sistema.
            </>
          )
        }
        rotuloConfirmar={alvo?.ativo ? 'Desativar' : 'Reativar'}
        perigo={alvo?.ativo ?? false}
        ocupado={alterar.isPending}
        erro={alterar.isError ? mensagemDeErro(alterar.error) : null}
        aoConfirmar={confirmarSituacao}
        aoCancelar={() => setAlvo(null)}
      />
    </section>
  )
}
