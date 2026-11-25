/** Conteúdos mínimos com as assinaturas reais de cada formato. */
export const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
])
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
export const PDF = new TextEncoder().encode('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
export const PCAP = new Uint8Array([0xd4, 0xc3, 0xb2, 0xa1, 2, 0, 4, 0, 0, 0, 0, 0])
export const PCAPNG = new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a, 0x1c, 0, 0, 0])
export const TXT = new TextEncoder().encode(
  'GET /login HTTP/1.1\nHost: 10.0.0.40\n\nusuario=admin&senha=admin\n',
)
export const HTML = new TextEncoder().encode(
  '<!doctype html><script>alert(document.cookie)</script>',
)
export const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
)
export const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0])
