import { describe, expect, it } from 'vitest'
import {
  calcularDataLimite,
  novaDataLimite,
  PRAZOS_PADRAO,
  somarDias,
  type EstadoPrazo,
} from '../../src/dominio/prazo.js'

describe('prazo por severidade (RN10)', () => {
  it.each([
    ['Critica', '2026-05-10', '2026-05-17'],
    ['Alta', '2026-05-10', '2026-06-09'],
    ['Media', '2026-05-10', '2026-08-08'],
    ['Baixa', '2026-05-10', '2026-11-06'],
    ['Informativa', '2026-05-10', null],
  ] as const)('%s registrado em %s vence em %s', (sev, data, esperado) => {
    expect(calcularDataLimite(sev, data)).toBe(esperado)
  })

  it('usa os prazos configurados', () => {
    expect(calcularDataLimite('Critica', '2026-05-10', { ...PRAZOS_PADRAO, Critica: 2 })).toBe(
      '2026-05-12',
    )
  })

  it('soma dias atravessando mês, ano e 29 de fevereiro', () => {
    expect(somarDias('2026-12-28', 7)).toBe('2027-01-04')
    expect(somarDias('2028-02-27', 2)).toBe('2028-02-29')
  })
})

describe('novaDataLimite (RF24)', () => {
  const base: EstadoPrazo = {
    severidade: 'Alta',
    dataLimite: '2026-06-09',
    dataLimiteManual: false,
    dataRegistro: '2026-05-10',
  }

  it('mudança de severidade recalcula a partir da data de registro', () => {
    expect(novaDataLimite(base, 'Critica', undefined)).toEqual({
      dataLimite: '2026-05-17',
      dataLimiteManual: false,
    })
    expect(novaDataLimite(base, 'Informativa', '2026-06-09')).toEqual({
      dataLimite: null,
      dataLimiteManual: false,
    })
  })

  it('valor informado e diferente é ajuste manual', () => {
    expect(novaDataLimite(base, 'Critica', '2026-07-01')).toEqual({
      dataLimite: '2026-07-01',
      dataLimiteManual: true,
    })
    expect(novaDataLimite(base, 'Alta', null)).toEqual({ dataLimite: null, dataLimiteManual: true })
  })

  it('ajuste manual não é sobrescrito por mudança de severidade', () => {
    const manual = { ...base, dataLimite: '2026-12-31', dataLimiteManual: true }
    expect(novaDataLimite(manual, 'Critica', undefined)).toEqual({
      dataLimite: '2026-12-31',
      dataLimiteManual: true,
    })
    expect(novaDataLimite(manual, 'Critica', '2026-12-31')).toEqual({
      dataLimite: '2026-12-31',
      dataLimiteManual: true,
    })
  })

  it('sem mudanças mantém o estado', () => {
    expect(novaDataLimite(base, 'Alta', undefined)).toEqual({
      dataLimite: '2026-06-09',
      dataLimiteManual: false,
    })
  })
})
