const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Data no formato AAAA-MM-DD (coluna date) exibida como DD/MM/AAAA. */
export function formatarData(data: string | null): string {
  if (!data) return '—'
  return formatoData.format(new Date(`${data}T00:00:00Z`))
}

export function formatarDataHora(instante: string | Date | null): string {
  if (!instante) return '—'
  return formatoDataHora.format(new Date(instante))
}
