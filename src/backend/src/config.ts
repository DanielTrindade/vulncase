import { z } from 'zod'
import type { PrazosSeveridade } from './dominio/prazo.js'

const esquemaConfig = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ORIGEM_PERMITIDA: z.url({ protocol: /^https?$/ }),
  EVIDENCIAS_DIRETORIO: z.string().min(1).default('/data/evidencias'),
  EVIDENCIAS_TAMANHO_MAXIMO_BYTES: z.coerce.number().int().positive().default(5_242_880),
  ADMIN_EMAIL_INICIAL: z.email().optional(),
  ADMIN_SENHA_INICIAL: z.string().min(10).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // RN10: prazos de correção em dias por severidade (Informativa não tem prazo).
  PRAZO_DIAS_CRITICA: z.coerce.number().int().min(1).max(3650).default(7),
  PRAZO_DIAS_ALTA: z.coerce.number().int().min(1).max(3650).default(30),
  PRAZO_DIAS_MEDIA: z.coerce.number().int().min(1).max(3650).default(90),
  PRAZO_DIAS_BAIXA: z.coerce.number().int().min(1).max(3650).default(180),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export interface Config {
  databaseUrl: string
  origemPermitida: string
  evidenciasDiretorio: string
  evidenciasTamanhoMaximoBytes: number
  adminEmailInicial: string | undefined
  adminSenhaInicial: string | undefined
  ambiente: 'development' | 'production' | 'test'
  porta: number
  nivelLog: string
  prazos: PrazosSeveridade
}

export class ConfiguracaoInvalidaError extends Error {
  constructor(public readonly campos: string[]) {
    super(`Configuração inválida: ${campos.join(', ')}`)
    this.name = 'ConfiguracaoInvalidaError'
  }
}

/**
 * Lê e valida as variáveis de ambiente (RNF12). Valores vazios são tratados como ausentes.
 * Em caso de erro, lista apenas os nomes das variáveis, nunca os valores.
 */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const limpo = Object.fromEntries(
    Object.entries(env).filter(([, valor]) => valor !== undefined && valor !== ''),
  )
  const resultado = esquemaConfig.safeParse(limpo)
  if (!resultado.success) {
    const campos = [...new Set(resultado.error.issues.map((i) => String(i.path[0])))]
    throw new ConfiguracaoInvalidaError(campos)
  }
  const c = resultado.data
  // Origem é comparada exatamente pelo middleware csrf: normaliza sem barra final.
  const origem = new URL(c.ORIGEM_PERMITIDA).origin
  return {
    databaseUrl: c.DATABASE_URL,
    origemPermitida: origem,
    evidenciasDiretorio: c.EVIDENCIAS_DIRETORIO,
    evidenciasTamanhoMaximoBytes: c.EVIDENCIAS_TAMANHO_MAXIMO_BYTES,
    adminEmailInicial: c.ADMIN_EMAIL_INICIAL,
    adminSenhaInicial: c.ADMIN_SENHA_INICIAL,
    ambiente: c.NODE_ENV,
    porta: c.PORT,
    nivelLog: c.LOG_LEVEL,
    prazos: {
      Critica: c.PRAZO_DIAS_CRITICA,
      Alta: c.PRAZO_DIAS_ALTA,
      Media: c.PRAZO_DIAS_MEDIA,
      Baixa: c.PRAZO_DIAS_BAIXA,
      Informativa: null,
    },
  }
}
