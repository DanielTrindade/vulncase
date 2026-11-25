import { useEffect, useRef, type ReactNode } from 'react'

interface PropsDialogo {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

/** Diálogo modal nativo (<dialog>), com foco preso e fechamento por Esc. */
export function Dialogo({ aberto, titulo, aoFechar, children }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog ref={ref} className="dialogo" onClose={aoFechar} aria-label={titulo}>
      <h2>{titulo}</h2>
      {aberto && children}
    </dialog>
  )
}

interface PropsConfirmar {
  aberto: boolean
  titulo: string
  mensagem: ReactNode
  rotuloConfirmar: string
  perigo?: boolean
  ocupado?: boolean
  erro?: string | null
  aoConfirmar: () => void
  aoCancelar: () => void
}

export function DialogoConfirmacao(p: PropsConfirmar) {
  return (
    <Dialogo aberto={p.aberto} titulo={p.titulo} aoFechar={p.aoCancelar}>
      {p.erro && (
        <div className="alerta alerta--erro" role="alert">
          {p.erro}
        </div>
      )}
      <p>{p.mensagem}</p>
      <div className="dialogo__acoes">
        <button type="button" className="botao" onClick={p.aoCancelar} disabled={p.ocupado}>
          Cancelar
        </button>
        <button
          type="button"
          className={p.perigo ? 'botao botao--perigo' : 'botao botao--primario'}
          onClick={p.aoConfirmar}
          disabled={p.ocupado}
        >
          {p.rotuloConfirmar}
        </button>
      </div>
    </Dialogo>
  )
}
