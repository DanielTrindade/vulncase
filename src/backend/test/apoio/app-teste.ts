import type { Papel } from '@vulncase/compartilhado'
import { criarApp } from '../../src/app.js'
import { carregarConfig } from '../../src/config.js'
import { usuarios } from '../../src/db/schema.js'
import { gerarHash } from '../../src/infra/senha.js'
import { NOME_COOKIE_SESSAO } from '../../src/middlewares/sessao.js'
import { criarBancoIsolado } from './banco.js'
import { criarLogMemoria } from './log-memoria.js'

export const ORIGEM = 'https://localhost'
export const SENHA_PADRAO = 'senha-de-teste-123'

let hashPadrao: Promise<string> | undefined

/** App com banco real isolado, para testes de integração HTTP. */
export async function criarAmbienteTeste() {
  const banco = await criarBancoIsolado()
  const { log, linhas } = criarLogMemoria()
  const config = carregarConfig({ DATABASE_URL: banco.url, ORIGEM_PERMITIDA: ORIGEM })
  const app = criarApp({ db: banco.db, config, log })

  async function requisitar(
    caminho: string,
    opcoes: {
      metodo?: string
      corpo?: unknown
      cookie?: string
      cabecalhos?: Record<string, string>
    } = {},
  ) {
    const cabecalhos: Record<string, string> = { Origin: ORIGEM, ...opcoes.cabecalhos }
    if (opcoes.cookie) cabecalhos.Cookie = opcoes.cookie
    let body: string | undefined
    if (opcoes.corpo !== undefined) {
      cabecalhos['Content-Type'] = 'application/json'
      body = JSON.stringify(opcoes.corpo)
    }
    return app.request(caminho, { method: opcoes.metodo ?? 'GET', headers: cabecalhos, body })
  }

  async function criarUsuario(
    papel: Papel,
    dados: { email?: string; nome?: string; senha?: string; ativo?: boolean } = {},
  ) {
    const senha = dados.senha ?? SENHA_PADRAO
    hashPadrao ??= gerarHash(SENHA_PADRAO)
    const passwordHash = senha === SENHA_PADRAO ? await hashPadrao : await gerarHash(senha)
    const [u] = await banco.db
      .insert(usuarios)
      .values({
        nome: dados.nome ?? `${papel} de teste`,
        email:
          dados.email ?? `${papel.toLowerCase()}.${crypto.randomUUID().slice(0, 8)}@teste.local`,
        papel,
        passwordHash,
        ativo: dados.ativo ?? true,
      })
      .returning()
    return { ...u!, senha }
  }

  /** Entra e devolve o valor para o cabeçalho Cookie. */
  async function entrar(email: string, senha: string = SENHA_PADRAO): Promise<string> {
    const res = await requisitar('/api/auth/login', { metodo: 'POST', corpo: { email, senha } })
    if (res.status !== 200) throw new Error(`login falhou: ${res.status}`)
    return extrairCookie(res)
  }

  /** Cria um usuário do papel informado e devolve-o com o cookie de sessão. */
  async function sessaoDe(papel: Papel) {
    const usuario = await criarUsuario(papel)
    const cookie = await entrar(usuario.email)
    return { usuario, cookie }
  }

  return { app, banco, db: banco.db, log, linhas, requisitar, criarUsuario, entrar, sessaoDe }
}

export function extrairCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const par = setCookie.split(';')[0] ?? ''
  if (!par.startsWith(`${NOME_COOKIE_SESSAO}=`)) throw new Error('cookie de sessão ausente')
  return par
}

export type AmbienteTeste = Awaited<ReturnType<typeof criarAmbienteTeste>>
