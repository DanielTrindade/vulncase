import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'

/** Limite padrão para corpos JSON; a rota de evidências sobrescreve (RNF14). */
export const LIMITE_CORPO_JSON = 64 * 1024

/**
 * Cabeçalhos de segurança (RNF10). A CSP não permite scripts inline nem de outras
 * origens; estilos inline são aceitos apenas para bibliotecas de gráficos.
 */
export function cabecalhosSeguranca() {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    crossOriginResourcePolicy: 'same-origin',
    crossOriginOpenerPolicy: 'same-origin',
  })
}

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Proteção contra CSRF (RNF05, A03). Requisições que alteram estado só são aceitas se o
 * cabeçalho Origin for exatamente a origem configurada ou se o navegador indicar
 * Sec-Fetch-Site: same-origin. Requisições sem nenhum dos dois são recusadas.
 *
 * O middleware csrf nativo do Hono só verifica tipos de conteúdo de formulário
 * (x-www-form-urlencoded, multipart e text/plain) e deixa passar JSON. Como a API
 * aceita JSON e multipart, a verificação aqui vale para qualquer tipo de conteúdo.
 */
export function verificarOrigem(origemPermitida: string) {
  return createMiddleware(async (c, next) => {
    if (!METODOS_SEGUROS.has(c.req.method)) {
      const origem = c.req.header('origin')
      const secFetchSite = c.req.header('sec-fetch-site')
      const permitido =
        origem !== undefined ? origem === origemPermitida : secFetchSite === 'same-origin'
      if (!permitido) throw new HTTPException(403)
    }
    await next()
  })
}

export function limitarCorpo(maxSize: number = LIMITE_CORPO_JSON) {
  return bodyLimit({
    maxSize,
    onError: () => {
      throw new HTTPException(413)
    },
  })
}
