import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { secureHeaders } from 'hono/secure-headers'
import { HTTPException } from 'hono/http-exception'

/** Limite padrão para corpos JSON; a rota de evidências sobrescreve (RNF14). */
export const LIMITE_CORPO_JSON = 64 * 1024

/**
 * Cabeçalhos de segurança (RNF10). A CSP não permite scripts inline nem de outras
 * origens, nem estilos em elementos <style> ou atributos style no HTML.
 */
export function cabecalhosSeguranca() {
  const aplicar = secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
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
  // Uma rota pode definir CSP mais restritiva (ex.: download com sandbox); o
  // secureHeaders sobrescreveria o valor, então ele é restaurado depois.
  return createMiddleware(async (c, next) => {
    let cspDaRota: string | null = null
    await aplicar(c, async () => {
      await next()
      cspDaRota = c.res.headers.get('Content-Security-Policy')
    })
    if (cspDaRota) c.res.headers.set('Content-Security-Policy', cspDaRota)
    // Respostas da API contêm dados confidenciais (detalhes de exploração): sem cache.
    if (!c.res.headers.has('Cache-Control')) {
      c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
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

/** Folga para os delimitadores e campos do multipart além do próprio arquivo. */
const FOLGA_MULTIPART = 64 * 1024
const ROTA_ENVIO_EVIDENCIA = /^\/api\/achados\/[^/]+\/evidencias$/

/**
 * Limite de corpo por rota: 64 KB para JSON e, só no envio de evidências, o tamanho
 * máximo configurado mais a folga do multipart (RNF14, A14).
 */
export function limitarCorpoPorRota(tamanhoMaximoEvidencia: number) {
  const padrao = limitarCorpo(LIMITE_CORPO_JSON)
  const evidencia = limitarCorpo(tamanhoMaximoEvidencia + FOLGA_MULTIPART)
  return createMiddleware(async (c, next) => {
    const envio = c.req.method === 'POST' && ROTA_ENVIO_EVIDENCIA.test(c.req.path)
    return (envio ? evidencia : padrao)(c, next)
  })
}
