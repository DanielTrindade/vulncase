import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  type Severidade,
  type StatusAchado,
} from '@vulncase/compartilhado'

export function SeloSeveridade({
  severidade,
  quantidade,
}: {
  severidade: Severidade
  quantidade?: number
}) {
  return (
    <span className={`selo selo--${severidade}`} title={ROTULOS_SEVERIDADE[severidade]}>
      {ROTULOS_SEVERIDADE[severidade]}
      {quantidade !== undefined && <strong>{quantidade}</strong>}
    </span>
  )
}

export function SeloStatus({ status }: { status: StatusAchado }) {
  return <span className={`selo selo--status selo--${status}`}>{ROTULOS_STATUS[status]}</span>
}
