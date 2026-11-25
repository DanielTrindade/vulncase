import { useState } from 'react'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import { useAtribuirResponsavel, type Achado } from '../../api/achados'
import { useResponsaveis } from '../../api/usuarios'

/** Exibe o responsável e, quando permitido, permite atribuir, trocar ou remover (RF15). */
export function Responsavel({ achado, aoConflito }: { achado: Achado; aoConflito: () => void }) {
  const pode = achado.acoes.atribuirResponsavel
  const responsaveis = useResponsaveis(pode)
  const atribuir = useAtribuirResponsavel()
  const [escolhido, setEscolhido] = useState(achado.responsavel?.id ?? '')
  const mudou = escolhido !== (achado.responsavel?.id ?? '')

  async function salvar(responsavelId: string | null) {
    try {
      await atribuir.mutateAsync({ id: achado.id, dados: { responsavelId, versao: achado.versao } })
    } catch (err) {
      if (err instanceof ErroApi && err.problema.title === 'Conflito de versão') aoConflito()
    }
  }

  if (!pode)
    return (
      <span>
        {achado.responsavel?.nome ?? <span className="texto-suave">Sem responsável</span>}
      </span>
    )

  return (
    <div className="responsavel">
      <div className="acoes">
        <select
          aria-label="Responsável"
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
          disabled={atribuir.isPending}
        >
          <option value="">Sem responsável</option>
          {responsaveis.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        {mudou && (
          <button
            type="button"
            className="botao botao--primario botao--pequeno"
            disabled={atribuir.isPending}
            onClick={() => void salvar(escolhido || null)}
          >
            {escolhido ? 'Atribuir' : 'Remover responsável'}
          </button>
        )}
      </div>
      {mudou && !escolhido && achado.status === 'EmCorrecao' && (
        <span className="campo__ajuda">O achado voltará para Aberto.</span>
      )}
      {atribuir.isError && <span className="campo__erro">{mensagemDeErro(atribuir.error)}</span>}
    </div>
  )
}
