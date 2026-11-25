import type { Severidade } from '@vulncase/compartilhado'

/** Dias de prazo por severidade; null = sem prazo (RN10). */
export type PrazosSeveridade = Record<Severidade, number | null>

export const PRAZOS_PADRAO: PrazosSeveridade = {
  Critica: 7,
  Alta: 30,
  Media: 90,
  Baixa: 180,
  Informativa: null,
}

/** Soma dias a uma data AAAA-MM-DD, em UTC. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** RN10: data de registro + prazo da severidade. */
export function calcularDataLimite(
  severidade: Severidade,
  dataRegistro: string,
  prazos: PrazosSeveridade = PRAZOS_PADRAO,
): string | null {
  const dias = prazos[severidade]
  return dias === null ? null : somarDias(dataRegistro, dias)
}

export interface EstadoPrazo {
  severidade: Severidade
  dataLimite: string | null
  dataLimiteManual: boolean
  /** Data de registro do achado (AAAA-MM-DD). */
  dataRegistro: string
}

/**
 * Data-limite após uma edição (RF24). Um valor informado e diferente do atual é um
 * ajuste manual e prevalece. Sem ajuste, a mudança de severidade recalcula o prazo,
 * a menos que a data atual já tenha sido ajustada manualmente.
 */
export function novaDataLimite(
  atual: EstadoPrazo,
  novaSeveridade: Severidade,
  informada: string | null | undefined,
  prazos: PrazosSeveridade = PRAZOS_PADRAO,
): { dataLimite: string | null; dataLimiteManual: boolean } {
  if (informada !== undefined && informada !== atual.dataLimite) {
    return { dataLimite: informada, dataLimiteManual: true }
  }
  if (novaSeveridade !== atual.severidade && !atual.dataLimiteManual) {
    return {
      dataLimite: calcularDataLimite(novaSeveridade, atual.dataRegistro, prazos),
      dataLimiteManual: false,
    }
  }
  return { dataLimite: atual.dataLimite, dataLimiteManual: atual.dataLimiteManual }
}
