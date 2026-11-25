import type { ReactNode } from 'react'
import { CircleAlertIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { buttonVariants } from '@/componentes/ui/button'
import { Spinner } from '@/componentes/ui/spinner'

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

/** Confirmação de ação com consequência (AlertDialog do shadcn/ui). */
export function DialogoConfirmacao(p: PropsConfirmar) {
  return (
    <AlertDialog open={p.aberto} onOpenChange={(aberto) => !aberto && !p.ocupado && p.aoCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p.titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{p.mensagem}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {p.erro && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{p.erro}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={p.ocupado}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={p.perigo ? buttonVariants({ variant: 'destructive' }) : undefined}
            disabled={p.ocupado}
            onClick={(e) => {
              // Mantém o diálogo aberto até a operação terminar (o erro aparece aqui).
              e.preventDefault()
              p.aoConfirmar()
            }}
          >
            {p.ocupado && <Spinner />}
            {p.rotuloConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
