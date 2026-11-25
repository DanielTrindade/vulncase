/**
 * Registra o resultado da verificação de segurança como achados do projeto "VulnCase"
 * (prefixo VULN) na própria ferramenta (docs/05, seção 5; docs/08).
 * Executar depois de scripts/verificacao-seguranca.cjs, no mesmo ambiente.
 * Uso: node scripts/registrar-verificacao.cjs docs/verificacao/resultados.json [pasta-das-capturas]
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = 'https://localhost'
const SENHA = 'senha-de-verificacao-1'
const { resultados } = JSON.parse(
  fs.readFileSync(process.argv[2] ?? 'docs/verificacao/resultados.json', 'utf8'),
)
const CAPTURAS = process.argv[3]

const DADOS_TESTES = {
  T1: {
    severidade: 'Alta',
    cwe: 79,
    owasp: 3,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'Campos de texto de achados, projetos, ativos e comentários',
    controle:
      'React renderiza o conteúdo como texto, dangerouslySetInnerHTML é proibido por lint e a CSP não permite scripts inline.',
  },
  T2: {
    severidade: 'Critica',
    cwe: 89,
    owasp: 3,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'GET /api/achados (parâmetros de filtro)',
    controle:
      'Consultas parametrizadas pelo Drizzle, filtros validados com Zod e ordenação por lista fechada.',
  },
  T3: {
    severidade: 'Alta',
    cwe: 862,
    owasp: 1,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'Rotas de Analista e Administrador da API',
    controle: 'exigirPapel em cada rota e regras de propriedade no domínio.',
  },
  T4: {
    severidade: 'Alta',
    cwe: 434,
    owasp: 4,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'POST /api/achados/{id}/evidencias',
    controle:
      'Lista de extensões, verificação de assinatura, nome UUID e download como anexo com nosniff.',
  },
  T5: {
    severidade: 'Alta',
    cwe: 352,
    owasp: 1,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'Rotas que alteram estado',
    controle:
      'Cookie SameSite=Strict e verificação de origem em toda requisição que altera estado.',
  },
}

/** Problemas reais encontrados durante a implementação e a verificação, já corrigidos. */
const CORRIGIDOS = [
  {
    titulo: 'Middleware csrf nativo do Hono não verificava requisições JSON',
    severidade: 'Alta',
    cwe: 352,
    owasp: 1,
    origem: 'RevisaoCodigo',
    localizacao: 'src/backend/src/middlewares/seguranca.ts',
    descricao:
      'O middleware csrf do Hono só confere a origem de corpos de formulário (x-www-form-urlencoded, multipart e text/plain). Requisições JSON de outra origem passavam pela verificação.',
    impacto: 'A proteção de RNF05 dependia apenas do SameSite=Strict para rotas JSON.',
    correcao:
      'Middleware próprio verificarOrigem, que exige Origin igual à configurada ou Sec-Fetch-Site same-origin em qualquer tipo de conteúdo.',
    conclusao:
      'Middleware verificarOrigem implementado com testes de JSON, formulário, ausência de Origin e Sec-Fetch-Site cross-site (branch feat/7-middlewares-seguranca).',
    verificacao: 'T5 da verificação: POST de outra origem retorna 403 para JSON e text/plain.',
  },
  {
    titulo: 'CSP permitia estilos inline (style-src unsafe-inline)',
    severidade: 'Baixa',
    cwe: 693,
    owasp: 5,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'Content-Security-Policy da API e do front-end',
    descricao: "OWASP ZAP (regra 10055) apontou style-src 'unsafe-inline' na CSP.",
    impacto: 'Amplia a superfície para injeção de CSS caso surja uma falha de injeção de HTML.',
    correcao:
      "Remover 'unsafe-inline' de style-src; o front-end não usa elementos <style> nem atributos style no HTML servido.",
    conclusao:
      "style-src 'self' na API e no Caddy; todas as telas percorridas sem violação de CSP.",
    verificacao:
      'Nova varredura do ZAP sem o alerta 10055; roteiro de aceite 8/8 com a CSP restrita.',
  },
  {
    titulo: 'HSTS ausente nas respostas do front-end',
    severidade: 'Baixa',
    cwe: 319,
    owasp: 5,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'Caddyfile (proxy)',
    descricao:
      'OWASP ZAP (regra 10035): o cabeçalho Strict-Transport-Security só era enviado pela API.',
    impacto: 'O primeiro acesso ao front-end poderia ser rebaixado para HTTP.',
    correcao: 'Enviar Strict-Transport-Security no proxy para todas as respostas.',
    conclusao: 'Cabeçalho adicionado no bloco do site no Caddyfile.',
    verificacao: 'Nova varredura do ZAP sem o alerta 10035.',
  },
  {
    titulo: 'Cache-Control permissivo nas páginas e nas respostas da API',
    severidade: 'Baixa',
    cwe: 525,
    owasp: 4,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'docker/Caddyfile.web e middleware de cabeçalhos da API',
    descricao:
      'OWASP ZAP (regra 10015): a página servida para as rotas da SPA tinha só no-store e as respostas JSON da API não tinham Cache-Control.',
    impacto: 'Detalhes de exploração poderiam ficar em caches intermediários ou do navegador.',
    correcao:
      'Cache-Control: no-cache, no-store, must-revalidate em todo conteúdo que não seja arquivo com hash.',
    conclusao:
      'Cabeçalho aplicado no Caddy para rotas fora de /assets e na API para toda resposta sem Cache-Control próprio.',
    verificacao:
      'Nova varredura do ZAP sem o alerta 10015; teste automatizado do cabeçalho na API.',
  },
  {
    titulo: 'Proxy recusava conexões TLS sem SNI',
    severidade: 'Informativa',
    cwe: null,
    owasp: 5,
    origem: 'AnaliseConfiguracao',
    localizacao: 'Caddyfile (opções globais)',
    descricao:
      'Clientes Java, como o OWASP ZAP, não enviam SNI para "localhost"; o Caddy encerrava o handshake com internal_error.',
    impacto: 'Impedia a varredura automatizada e clientes sem SNI.',
    correcao: 'Definir default_sni localhost nas opções globais do Caddy.',
    conclusao: 'Opção default_sni adicionada.',
    verificacao: 'OWASP ZAP conclui o handshake e a varredura.',
  },
  {
    titulo: 'Dependências de desenvolvimento com vulnerabilidades moderadas',
    severidade: 'Media',
    cwe: 1395,
    owasp: 6,
    origem: 'AnaliseConfiguracao',
    localizacao: 'pnpm-lock.yaml (esbuild via drizzle-kit; glob e minimatch via testcontainers)',
    descricao:
      'pnpm audit apontou 3 vulnerabilidades moderadas (GHSA-67mh-4wv8-2f99, GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249) em dependências transitivas de ferramentas de desenvolvimento. As dependências de produção não tinham vulnerabilidades.',
    impacto: 'Exposição restrita às máquinas de desenvolvimento e ao CI.',
    correcao: 'Forçar versões corrigidas com overrides no pnpm-workspace.yaml.',
    conclusao:
      'Overrides para esbuild >= 0.25.12, glob >= 14.0.2 e minimatch >= 11.0.1; drizzle-kit e testes funcionando.',
    verificacao: 'pnpm audit: No known vulnerabilities found.',
  },
  {
    titulo: 'Download de evidência sem arquivo no volume retornava erro 500',
    severidade: 'Baixa',
    cwe: 755,
    owasp: 4,
    origem: 'TesteAplicacaoWeb',
    localizacao: 'GET /api/evidencias/{id}/download',
    descricao:
      'Quando o registro existia mas o arquivo não estava no volume, a leitura lançava ENOENT e a API respondia 500.',
    impacto: 'Erro genérico sem diagnóstico para o usuário e para a operação.',
    correcao: 'Tratar ENOENT como 404 e registrar o evento evidencia.arquivo_ausente no log.',
    conclusao: 'Tratamento implementado com teste de integração (branch feat/33-comentarios).',
    verificacao: 'Teste remove o arquivo do disco e recebe 404.',
  },
]

async function contexto(b) {
  return b.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  })
}
async function entrar(p, email, senha) {
  await p.goto(BASE + '/entrar')
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', senha)
  await p.click('button[type=submit]')
  await p.waitForURL(BASE + '/')
}
async function api(p, metodo, caminho, corpo) {
  const r = await p.request.fetch(BASE + caminho, {
    method: metodo,
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    data: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
  if (!r.ok()) throw new Error(`${metodo} ${caminho}: ${r.status()} ${await r.text()}`)
  return r.status() === 204 ? null : r.json()
}

;(async () => {
  // CHROMIUM_PATH permite usar um Chromium já instalado no sistema.
  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  )
  const ana = await (await contexto(b)).newPage()
  await entrar(ana, 'ana.verif@lab.local', SENHA)
  const davi = await (await contexto(b)).newPage()
  await entrar(davi, 'davi.verif@lab.local', SENHA)
  const eu = (await api(ana, 'GET', '/api/auth/me')).usuario
  const dev = (await api(davi, 'GET', '/api/auth/me')).usuario

  const projeto = await api(ana, 'POST', '/api/projetos', {
    prefixo: 'VULN',
    nome: 'VulnCase',
    descricao: 'Verificação de segurança da própria ferramenta (documento 05, seção 5).',
    responsavelTecnicoId: eu.id,
  })
  const ativo = await api(ana, 'POST', `/api/projetos/${projeto.id}/ativos`, {
    nome: 'VulnCase local',
    tipo: 'AplicacaoWeb',
    identificador: 'https://localhost',
    ambiente: 'Laboratorio',
  })

  const registrar = (d) =>
    api(ana, 'POST', `/api/projetos/${projeto.id}/achados`, {
      titulo: d.titulo,
      descricao: d.descricao,
      origem: d.origem,
      severidade: d.severidade,
      localizacao: d.localizacao,
      impacto: d.impacto ?? null,
      passosReproducao: d.passos ?? null,
      correcaoProposta: d.correcao,
      categoriaOwaspId: d.owasp,
      cweId: d.cwe,
      ativoId: ativo.id,
    })
  const transicionar = (p, a, destino, justificativa) =>
    api(p, 'POST', `/api/achados/${a.id}/transicoes`, { destino, justificativa, versao: a.versao })

  // Testes sem vulnerabilidade: registrados e encerrados como falso positivo com a evidência.
  for (const r of resultados) {
    const t = DADOS_TESTES[r.id]
    let a = await registrar({
      titulo: `${r.id} — ${r.nome}`,
      descricao: `Teste da seção 5 do documento 05.\n\n${r.evidencias.map((e) => `• ${e}`).join('\n')}`,
      origem: t.origem,
      severidade: t.severidade,
      localizacao: t.localizacao,
      passos: 'Executar scripts/verificacao-seguranca.cjs contra https://localhost.',
      correcao: t.controle,
      owasp: t.owasp,
      cwe: t.cwe,
    })
    await api(ana, 'POST', `/api/achados/${a.id}/comentarios`, {
      texto: `Controle verificado: ${t.controle}`,
    })
    a = await transicionar(
      ana,
      a,
      r.aprovado ? 'FalsoPositivo' : 'EmCorrecao',
      r.aprovado
        ? `Teste executado em ${new Date().toLocaleDateString('pt-BR')}: a vulnerabilidade não se confirmou. ${t.controle}`
        : undefined,
    )
  }

  // Alerta informativo do ZAP.
  {
    const a = await registrar({
      titulo: 'ZAP 10109 — Modern Web Application',
      descricao:
        'Alerta informativo da varredura passiva do OWASP ZAP: a página carrega scripts sem links, indicando uma SPA.',
      origem: 'TesteAplicacaoWeb',
      severidade: 'Informativa',
      localizacao: 'https://localhost',
      correcao: 'Nenhuma; o alerta apenas sugere usar o AJAX Spider em varreduras.',
      owasp: null,
      cwe: null,
    })
    await transicionar(
      ana,
      a,
      'FalsoPositivo',
      'Alerta informativo, sem vulnerabilidade associada; o ZAP não recomenda mudança.',
    )
  }

  // Segredos versionados.
  {
    const a = await registrar({
      titulo: 'gitleaks — segredos versionados no repositório',
      descricao:
        'gitleaks 8.28 executado sobre o histórico Git e sobre o diretório de trabalho: no leaks found.',
      origem: 'RevisaoCodigo',
      severidade: 'Alta',
      localizacao: 'Repositório Git',
      owasp: 2,
      cwe: 798,
      correcao:
        'Manter segredos apenas em variáveis de ambiente; o CI executa o gitleaks a cada push e pull request.',
    })
    await transicionar(
      ana,
      a,
      'FalsoPositivo',
      'Nenhum segredo encontrado no histórico nem nos arquivos.',
    )
  }

  // Problemas reais, corrigidos com o fluxo completo.
  for (const d of CORRIGIDOS) {
    let a = await registrar(d)
    a = await api(ana, 'PUT', `/api/achados/${a.id}/responsavel`, {
      responsavelId: dev.id,
      versao: a.versao,
    })
    a = await transicionar(ana, a, 'EmCorrecao')
    a = await transicionar(davi, a, 'AguardandoVerificacao', d.conclusao)
    a = await transicionar(ana, a, 'Corrigido', d.verificacao)
  }

  if (CAPTURAS) {
    await ana.goto(`${BASE}/achados?projetoId=${projeto.id}&tamanhoPagina=50&ordenarPor=severidade`)
    await ana.waitForSelector('tbody tr')
    await ana.screenshot({
      path: `${CAPTURAS}/vuln-achados.jpg`,
      type: 'jpeg',
      quality: 80,
      fullPage: true,
    })
    await ana.goto(`${BASE}/projetos/${projeto.id}`)
    await ana.waitForSelector('[data-segmento]')
    await ana.waitForTimeout(800) // fim da animação de revelação da faixa
    await ana.screenshot({
      path: `${CAPTURAS}/vuln-painel.jpg`,
      type: 'jpeg',
      quality: 80,
      fullPage: true,
    })
  }
  const lista = await api(ana, 'GET', `/api/achados?projetoId=${projeto.id}&tamanhoPagina=50`)
  for (const i of lista.itens.sort((x, y) => x.codigo.localeCompare(y.codigo)))
    console.log(`${i.codigo}  ${i.status.padEnd(14)} ${i.severidade.padEnd(11)} ${i.titulo}`)
  await b.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
