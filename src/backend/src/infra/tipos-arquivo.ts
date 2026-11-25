import path from 'node:path'

/**
 * Tipos de evidência aceitos (RNF14, A05). O tipo de conteúdo é determinado pelo
 * servidor a partir da extensão e confirmado pela assinatura do arquivo; o tipo
 * informado pelo navegador é ignorado.
 */
interface TipoPermitido {
  tipoConteudo: string
  /** Confere a assinatura (magic bytes) ou, para texto, o conteúdo. */
  confere: (bytes: Uint8Array) => boolean
}

const comeca = (assinatura: number[]) => (b: Uint8Array) =>
  b.length >= assinatura.length && assinatura.every((v, i) => b[i] === v)

const algum =
  (...testes: ((b: Uint8Array) => boolean)[]) =>
  (b: Uint8Array) =>
    testes.some((t) => t(b))

/** Texto: UTF-8 válido e sem bytes nulos nem caracteres de controle binários. */
function ehTexto(b: Uint8Array): boolean {
  if (b.length === 0) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    return false
  }
  for (const byte of b) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) return false
  }
  return true
}

const PNG = comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG = comeca([0xff, 0xd8, 0xff])
const PDF = comeca([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-
const PCAP = algum(
  comeca([0xd4, 0xc3, 0xb2, 0xa1]),
  comeca([0xa1, 0xb2, 0xc3, 0xd4]),
  comeca([0x4d, 0x3c, 0xb2, 0xa1]),
  comeca([0xa1, 0xb2, 0x3c, 0x4d]),
)
const PCAPNG = comeca([0x0a, 0x0d, 0x0d, 0x0a])

export const TIPOS_PERMITIDOS: Record<string, TipoPermitido> = {
  '.png': { tipoConteudo: 'image/png', confere: PNG },
  '.jpg': { tipoConteudo: 'image/jpeg', confere: JPEG },
  '.jpeg': { tipoConteudo: 'image/jpeg', confere: JPEG },
  '.pdf': { tipoConteudo: 'application/pdf', confere: PDF },
  '.txt': { tipoConteudo: 'text/plain; charset=utf-8', confere: ehTexto },
  '.pcap': { tipoConteudo: 'application/vnd.tcpdump.pcap', confere: PCAP },
  '.pcapng': { tipoConteudo: 'application/x-pcapng', confere: PCAPNG },
}

export const EXTENSOES_PERMITIDAS = Object.keys(TIPOS_PERMITIDOS)

export type ResultadoTipo =
  | { ok: true; tipoConteudo: string; extensao: string }
  | { ok: false; motivo: 'extensao' | 'assinatura' }

export function identificarTipo(nomeOriginal: string, bytes: Uint8Array): ResultadoTipo {
  const extensao = path.extname(nomeOriginal).toLowerCase()
  const tipo = TIPOS_PERMITIDOS[extensao]
  if (!tipo) return { ok: false, motivo: 'extensao' }
  if (!tipo.confere(bytes)) return { ok: false, motivo: 'assinatura' }
  return { ok: true, tipoConteudo: tipo.tipoConteudo, extensao }
}

/**
 * Nome exibido e usado no cabeçalho de download: apenas o nome-base, sem caracteres
 * de controle, aspas, barras ou separadores de caminho, com no máximo 255 caracteres.
 */
export function sanitizarNomeArquivo(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '_').trim()
  return (limpo || 'evidencia').slice(0, 255)
}
