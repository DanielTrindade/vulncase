/**
 * Geração de CSV segura contra injeção de fórmulas (CWE-1236): células que começam
 * com =, +, -, @, tabulação ou retorno de carro recebem um apóstrofo, para que a
 * planilha as trate como texto.
 */
const INICIO_PERIGOSO = /^[=+\-@\t\r]/

export function neutralizarCelula(valor: string): string {
  return INICIO_PERIGOSO.test(valor) ? `'${valor}` : valor
}

function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '""'
  const texto = neutralizarCelula(String(valor))
  return `"${texto.replace(/"/g, '""')}"`
}

/**
 * Separador ";" e BOM UTF-8, para que planilhas em português abram as colunas e os
 * acentos corretamente. Todas as células vão entre aspas.
 */
export function gerarCsv(
  cabecalho: string[],
  linhas: (string | number | null | undefined)[][],
): string {
  const todas = [cabecalho, ...linhas].map((l) => l.map(celula).join(';'))
  return '\uFEFF' + todas.join('\r\n') + '\r\n'
}
