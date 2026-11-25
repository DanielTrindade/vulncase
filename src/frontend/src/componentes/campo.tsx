import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/componentes/ui/field'

interface PropsCampo {
  rotulo: string
  erro?: string | undefined
  ajuda?: ReactNode
  obrigatorio?: boolean
  className?: string
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
}

/** Rótulo, controle, ajuda e erro (componente Field do shadcn/ui) com acessibilidade. */
export function Campo({ rotulo, erro, ajuda, obrigatorio, className, children }: PropsCampo) {
  const id = useId()
  const idAjuda = `${id}-ajuda`
  const idErro = `${id}-erro`
  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ')
  return (
    <Field data-invalid={erro ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      {cloneElement(children, {
        id,
        'aria-invalid': erro ? true : undefined,
        'aria-describedby': descritores || undefined,
      })}
      {ajuda && !erro && <FieldDescription id={idAjuda}>{ajuda}</FieldDescription>}
      {erro && <FieldError id={idErro}>{erro}</FieldError>}
    </Field>
  )
}
