import { describe, expect, it } from 'vitest'
import { gerarCsv, neutralizarCelula } from '../../src/infra/csv.js'

describe('CSV (CWE-1236)', () => {
  it.each([
    ['=HYPERLINK("http://atacante","clique")', `'=HYPERLINK("http://atacante","clique")`],
    ['+1+1', `'+1+1`],
    ['-2+3', `'-2+3`],
    ['@SUM(A1)', `'@SUM(A1)`],
    ['\t=1', `'\t=1`],
    ['\r=1', `'\r=1`],
    ['texto normal', 'texto normal'],
    ['a=b', 'a=b'],
  ])('%j → %j', (entrada, saida) => {
    expect(neutralizarCelula(entrada)).toBe(saida)
  })

  it('aspas, ponto e vírgula e quebras de linha ficam dentro da célula', () => {
    const csv = gerarCsv(
      ['a', 'b'],
      [
        ['diz "oi"; tchau', 'linha 1\nlinha 2'],
        [null, 7.5],
      ],
    )
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toBe('\uFEFF"a";"b"\r\n"diz ""oi""; tchau";"linha 1\nlinha 2"\r\n"";"7.5"\r\n')
  })
})
