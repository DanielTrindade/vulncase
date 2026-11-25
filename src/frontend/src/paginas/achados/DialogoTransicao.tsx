import { useState, type FormEvent } from 'react'
import { ROTULOS_STATUS, type StatusAchado } from '@vulncase/compartilhado'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import { useTransicionar, type Achado } from '../../api/achados'
import { Dialogo } from '../../componentes/dialogo'

type Acao = Achado['acoes']['transicoes'][number]

interface Props {
  achado: Achado
  acao: Acao | null
  aoFechar: () => void
  aoConflito: () => void
}

/** Diálogo de transição; justificativa obrigatória quando a regra exige (RF17). */
export function DialogoTransicao({ achado, acao, aoFechar, aoConflito }: Props) {
  const transicionar = useTransicionar()
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function fechar() {
    setJustificativa('')
    setErro(null)
    transicionar.reset()
    aoFechar()
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!acao) return
    if (acao.exigeJustificativa && !justificativa.trim()) {
      setErro('Informe a justificativa.')
      return
    }
    setErro(null)
    try {
      await transicionar.mutateAsync({
        id: achado.id,
        dados: {
          destino: acao.destino,
          justificativa: justificativa.trim() || null,
          versao: achado.versao,
        },
      })
      fechar()
    } catch (err) {
      if (
        err instanceof ErroApi &&
        err.status === 409 &&
        err.problema.title === 'Conflito de versão'
      ) {
        fechar()
        aoConflito()
        return
      }
      setErro(
        err instanceof ErroApi
          ? (err.erroDoCampo('justificativa') ?? err.message)
          : mensagemDeErro(err),
      )
    }
  }

  return (
    <Dialogo aberto={acao !== null} titulo={acao?.rotulo ?? ''} aoFechar={fechar}>
      <form onSubmit={(e) => void aoEnviar(e)} className="formulario">
        <p>
          <span className="mono">{achado.codigo}</span> passará de{' '}
          <strong>{ROTULOS_STATUS[achado.status]}</strong> para{' '}
          <strong>{acao && ROTULOS_STATUS[acao.destino as StatusAchado]}</strong>.
        </p>
        {erro && (
          <div className="alerta alerta--erro" role="alert">
            {erro}
          </div>
        )}
        <label className="campo">
          <span className="campo__rotulo">
            Justificativa
            {acao?.exigeJustificativa ? (
              <span className="campo__obrigatorio">*</span>
            ) : (
              ' (opcional)'
            )}
          </span>
          <textarea
            rows={4}
            maxLength={4000}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            aria-invalid={erro ? true : undefined}
            autoFocus
          />
        </label>
        <div className="dialogo__acoes">
          <button
            type="button"
            className="botao"
            onClick={fechar}
            disabled={transicionar.isPending}
          >
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" disabled={transicionar.isPending}>
            {transicionar.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
