import { hc } from 'hono/client'
import type { AppType } from '@vulncase/backend/app'

/** Corpo Problem Details devolvido pela API em caso de erro. */
export interface Problema {
  title: string
  status: number
  detail?: string
  errors?: { campo: string; mensagem: string }[]
}

export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly problema: Problema,
  ) {
    super(problema.detail ?? problema.title)
    this.name = 'ErroApi'
  }

  /** Mensagem de erro de um campo específico, se houver. */
  erroDoCampo(campo: string): string | undefined {
    return this.problema.errors?.find((e) => e.campo === campo)?.mensagem
  }
}

export const EVENTO_NAO_AUTENTICADO = 'vulncase:nao-autenticado'

const fetchComSessao: typeof fetch = async (entrada, init) => {
  const res = await fetch(entrada, { ...init, credentials: 'same-origin' })
  if (res.status === 401) window.dispatchEvent(new Event(EVENTO_NAO_AUTENTICADO))
  return res
}

/** Cliente RPC tipado a partir das rotas do back-end (RNF21). */
export const api = hc<AppType>(window.location.origin, { fetch: fetchComSessao })

interface RespostaJson<T> {
  ok: boolean
  status: number
  json(): Promise<T>
}

async function lerProblema(res: { status: number; json(): Promise<unknown> }): Promise<never> {
  let problema: Problema
  try {
    problema = (await res.json()) as Problema
  } catch {
    problema = { title: 'Erro inesperado', status: res.status }
  }
  throw new ErroApi(res.status, problema)
}

/** Aguarda a resposta e devolve o corpo JSON, ou lança ErroApi. */
export async function ler<T>(promessa: Promise<RespostaJson<T>>): Promise<T> {
  const res = await promessa
  if (!res.ok) return lerProblema(res as RespostaJson<unknown>)
  return res.json()
}

/** Para respostas sem corpo (204). */
export async function enviar(
  promessa: Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
): Promise<void> {
  const res = await promessa
  if (!res.ok) await lerProblema(res)
}

export function mensagemDeErro(err: unknown): string {
  if (err instanceof ErroApi) return err.message
  return 'Não foi possível concluir a operação. Verifique a conexão e tente novamente.'
}
