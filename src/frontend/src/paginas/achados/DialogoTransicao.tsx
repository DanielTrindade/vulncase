import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowRightIcon, CircleAlertIcon } from 'lucide-react'
import type { StatusAchado } from '@vulncase/compartilhado'
import { ErroApi, mensagemDeErro } from '@/api/cliente'
import { useTransicionar, type Achado } from '@/api/achados'
import { SeloStatus } from '@/componentes/selos'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/componentes/ui/field'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'

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
      setErro('Escreva a justificativa para continuar.')
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
      toast.success(`${achado.codigo}: ${acao.rotulo.toLowerCase()}`)
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
    <Dialog
      open={acao !== null}
      onOpenChange={(aberto) => !aberto && !transicionar.isPending && fechar()}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(e) => void aoEnviar(e)} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{acao?.rotulo}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-mono text-foreground">{achado.codigo}</span>
                <SeloStatus status={achado.status} />
                <ArrowRightIcon className="size-4" aria-label="para" />
                {acao && <SeloStatus status={acao.destino as StatusAchado} />}
              </div>
            </DialogDescription>
          </DialogHeader>
          {erro && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={erro && acao?.exigeJustificativa ? true : undefined}>
            <FieldLabel htmlFor="justificativa">
              Justificativa
              {acao?.exigeJustificativa ? (
                <span aria-hidden className="text-destructive">
                  *
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">(opcional)</span>
              )}
            </FieldLabel>
            <Textarea
              id="justificativa"
              rows={4}
              maxLength={4000}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              aria-invalid={erro && acao?.exigeJustificativa ? true : undefined}
              autoFocus
            />
            <FieldDescription>Fica registrada no histórico do achado.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={fechar}
              disabled={transicionar.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={transicionar.isPending}>
              {transicionar.isPending && <Spinner />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
