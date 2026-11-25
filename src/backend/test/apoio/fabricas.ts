import type { AmbienteTeste } from './app-teste.js'

let contador = 0

/** Gera um prefixo único de 5 letras para cada projeto de teste. */
export function prefixoUnico(): string {
  contador += 1
  let n = contador + Math.floor(Math.random() * 1000) * 1000
  let s = ''
  for (let i = 0; i < 5; i++) {
    s += String.fromCharCode(65 + (n % 26))
    n = Math.floor(n / 26)
  }
  return s
}

export const achadoValido = (extra: Record<string, unknown> = {}) => ({
  titulo: 'Credenciais trafegam em texto claro via Telnet',
  descricao: 'O serviço Telnet na porta 23 aceita autenticação sem criptografia.',
  origem: 'AnaliseRede',
  severidade: 'Alta',
  localizacao: '10.0.0.15:23/tcp',
  impacto: 'Captura de usuário e senha por qualquer nó no mesmo segmento.',
  passosReproducao: 'Capturar tráfego no Wireshark e seguir o fluxo TCP.',
  correcaoProposta: 'Desativar o Telnet e usar SSH com autenticação por chave.',
  categoriaOwaspId: 2,
  cweId: 319,
  ...extra,
})

export async function criarProjetoApi(
  t: AmbienteTeste,
  cookie: string,
  responsavelTecnicoId: string,
) {
  const res = await t.requisitar('/api/projetos', {
    metodo: 'POST',
    cookie,
    corpo: { prefixo: prefixoUnico(), nome: 'Projeto de teste', responsavelTecnicoId },
  })
  if (res.status !== 201) throw new Error(`criar projeto: ${res.status} ${await res.text()}`)
  return (await res.json()) as { id: string; prefixo: string }
}

export interface AchadoResposta {
  id: string
  codigo: string
  status: string
  versao: number
  responsavel: { id: string; nome: string } | null
  acoes: {
    editar: boolean
    atribuirResponsavel: boolean
    transicoes: { destino: string; rotulo: string; exigeJustificativa: boolean }[]
  }
  [k: string]: unknown
}

export async function criarAchadoApi(
  t: AmbienteTeste,
  cookie: string,
  projetoId: string,
  extra: Record<string, unknown> = {},
): Promise<AchadoResposta> {
  const res = await t.requisitar(`/api/projetos/${projetoId}/achados`, {
    metodo: 'POST',
    cookie,
    corpo: achadoValido(extra),
  })
  if (res.status !== 201) throw new Error(`criar achado: ${res.status} ${await res.text()}`)
  return (await res.json()) as AchadoResposta
}
