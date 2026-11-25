import { describe, expect, it } from 'vitest'
import { identificarTipo, sanitizarNomeArquivo } from '../../src/infra/tipos-arquivo.js'
import { EXE, HTML, JPEG, PCAP, PCAPNG, PDF, PNG, SVG, TXT } from '../apoio/arquivos.js'

describe('identificarTipo', () => {
  it.each([
    ['print.png', PNG, 'image/png'],
    ['FOTO.JPG', JPEG, 'image/jpeg'],
    ['foto.jpeg', JPEG, 'image/jpeg'],
    ['relatorio.pdf', PDF, 'application/pdf'],
    ['captura.pcap', PCAP, 'application/vnd.tcpdump.pcap'],
    ['captura.pcap', new Uint8Array([0xa1, 0xb2, 0xc3, 0xd4]), 'application/vnd.tcpdump.pcap'],
    ['captura.pcapng', PCAPNG, 'application/x-pcapng'],
    ['requisicao.txt', TXT, 'text/plain; charset=utf-8'],
    ['html-como-texto.txt', HTML, 'text/plain; charset=utf-8'],
  ])('%s é aceito como %s', (nome, bytes, tipo) => {
    expect(identificarTipo(nome, bytes)).toMatchObject({ ok: true, tipoConteudo: tipo })
  })

  it.each([
    ['pagina.html', HTML],
    ['imagem.svg', SVG],
    ['programa.exe', EXE],
    ['sem-extensao', PNG],
    ['dupla.png.html', HTML],
  ])('%s é recusado pela extensão', (nome, bytes) => {
    expect(identificarTipo(nome, bytes)).toEqual({ ok: false, motivo: 'extensao' })
  })

  it.each([
    ['html renomeado.png', HTML],
    ['exe renomeado.pdf', EXE],
    ['svg renomeado.jpg', SVG],
    ['binário.txt', EXE],
    ['vazio.txt', new Uint8Array()],
    ['utf8-invalido.txt', new Uint8Array([0xc3, 0x28])],
    ['png curto.png', new Uint8Array([0x89, 0x50])],
  ])('%s é recusado pela assinatura', (nome, bytes) => {
    expect(identificarTipo(nome, bytes)).toEqual({ ok: false, motivo: 'assinatura' })
  })
})

describe('sanitizarNomeArquivo', () => {
  it.each([
    ['../../etc/passwd.txt', 'passwd.txt'],
    ['C:\\\\Windows\\\\win.ini.txt', 'win.ini.txt'],
    ['a"b<c>.png', 'a_b_c_.png'],
    ['linha\nnova.png', 'linha_nova.png'],
    ['', 'evidencia'],
    ['   ', 'evidencia'],
  ])('%j → %j', (entrada, saida) => {
    expect(sanitizarNomeArquivo(entrada)).toBe(saida)
  })

  it('limita a 255 caracteres', () => {
    expect(sanitizarNomeArquivo('a'.repeat(400) + '.png')).toHaveLength(255)
  })
})
