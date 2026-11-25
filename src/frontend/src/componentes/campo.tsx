import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

interface PropsCampo {
  rotulo: string
  erro?: string | undefined
  ajuda?: ReactNode
  obrigatorio?: boolean
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
}

/** Rótulo, controle, ajuda e mensagem de erro com os atributos de acessibilidade. */
export function Campo({ rotulo, erro, ajuda, obrigatorio, children }: PropsCampo) {
  const id = useId()
  const idAjuda = `${id}-ajuda`
  const idErro = `${id}-erro`
  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ')
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span className="campo__obrigatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descritores || undefined,
      })}
      {ajuda && (
        <span id={idAjuda} className="campo__ajuda">
          {ajuda}
        </span>
      )}
      {erro && (
        <span id={idErro} className="campo__erro">
          {erro}
        </span>
      )}
    </div>
  )
}
