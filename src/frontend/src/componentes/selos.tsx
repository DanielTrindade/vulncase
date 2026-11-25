import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  type Severidade,
  type StatusAchado,
} from '@vulncase/compartilhado'
import { cn } from '@/lib/utils'

/** Classe de cor por severidade (tokens --sev-*). */
export const COR_SEVERIDADE: Record<Severidade, string> = {
  Critica: 'bg-sev-critica',
  Alta: 'bg-sev-alta',
  Media: 'bg-sev-media',
  Baixa: 'bg-sev-baixa',
  Informativa: 'bg-sev-informativa',
}

export const BORDA_SEVERIDADE: Record<Severidade, string> = {
  Critica: 'border-l-sev-critica',
  Alta: 'border-l-sev-alta',
  Media: 'border-l-sev-media',
  Baixa: 'border-l-sev-baixa',
  Informativa: 'border-l-sev-informativa',
}

/**
 * Severidade: marcador quadrado na cor da escala e rótulo na cor do texto. A cor nunca
 * aparece sozinha (acessibilidade) e o texto mantém o contraste do tema.
 */
export function SeloSeveridade({
  severidade,
  quantidade,
  className,
}: {
  severidade: Severidade
  quantidade?: number
  className?: string
}) {
  return (
    <span
      data-severidade={severidade}
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap',
        className,
      )}
    >
      <span aria-hidden className={cn('size-2.5 rounded-[3px]', COR_SEVERIDADE[severidade])} />
      {ROTULOS_SEVERIDADE[severidade]}
      {quantidade !== undefined && (
        <span className="text-muted-foreground tabular-nums">{quantidade}</span>
      )}
    </span>
  )
}

const COR_STATUS: Record<StatusAchado, string> = {
  Aberto: 'text-st-aberto bg-st-aberto/10 ring-st-aberto/25',
  EmCorrecao: 'text-st-correcao bg-st-correcao/10 ring-st-correcao/25',
  AguardandoVerificacao: 'text-st-verificacao bg-st-verificacao/10 ring-st-verificacao/25',
  Corrigido: 'text-st-encerrado bg-st-encerrado/10 ring-st-encerrado/25',
  FalsoPositivo: 'text-st-neutro bg-st-neutro/10 ring-st-neutro/25',
  RiscoAceito: 'text-st-neutro bg-st-neutro/10 ring-st-neutro/25',
}

/** Status: pílula com tom do estado. Forma diferente da severidade para não confundir. */
export function SeloStatus({ status, className }: { status: StatusAchado; className?: string }) {
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        COR_STATUS[status],
        className,
      )}
    >
      {ROTULOS_STATUS[status]}
    </span>
  )
}

export function SeloVencido({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/25',
        className,
      )}
    >
      Vencido
    </span>
  )
}
