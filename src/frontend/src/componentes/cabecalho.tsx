import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cabeçalho de página: título, contexto opcional e ações à direita. */
export function CabecalhoPagina({
  titulo,
  descricao,
  antes,
  acoes,
  className,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  /** Linha acima do título (ex.: projeto e código do achado). */
  antes?: ReactNode
  acoes?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}
    >
      <div className="min-w-0">
        {antes && <div className="mb-1 text-sm text-muted-foreground">{antes}</div>}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] text-foreground">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Painel de conteúdo: borda, sem sombra (docs/09, Tabela 1). */
export function Painel({
  titulo,
  acoes,
  children,
  className,
}: {
  titulo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border bg-card p-5', className)}>
      {(titulo || acoes) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {titulo && <h2 className="text-base font-semibold">{titulo}</h2>}
          {acoes}
        </div>
      )}
      {children}
    </section>
  )
}
