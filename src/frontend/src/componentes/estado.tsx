import type { ReactNode } from 'react'
import { CircleAlertIcon, InboxIcon } from 'lucide-react'
import { mensagemDeErro } from '@/api/cliente'
import { Alert, AlertDescription, AlertTitle } from '@/componentes/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/componentes/ui/empty'
import { Spinner } from '@/componentes/ui/spinner'
import { cn } from '@/lib/utils'

export function Carregando({
  tela = false,
  texto = 'Carregando…',
}: {
  tela?: boolean
  texto?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 py-6 text-sm text-muted-foreground',
        tela && 'min-h-[60vh] justify-center',
      )}
    >
      <Spinner />
      {texto}
    </div>
  )
}

export function MensagemErro({ erro, titulo }: { erro: unknown; titulo?: string }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <CircleAlertIcon />
      <AlertTitle>{titulo ?? 'Não foi possível carregar'}</AlertTitle>
      <AlertDescription>{mensagemDeErro(erro)}</AlertDescription>
    </Alert>
  )
}

/** Estado vazio: um convite à ação, não um lamento (frontend-design). */
export function Vazio({
  titulo,
  children,
  acao,
}: {
  titulo: string
  children?: ReactNode
  acao?: ReactNode
}) {
  return (
    <Empty className="border border-dashed bg-card/50">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {acao}
    </Empty>
  )
}
