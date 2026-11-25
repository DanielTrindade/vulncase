/**
 * Verificação de segurança da própria ferramenta (docs/05-modelo-de-ameacas.md, seção 5).
 * Executa os testes 1 a 5 contra https://localhost pela interface e pela API e grava o
 * resultado de cada um em JSON. O registro dos achados no projeto "VulnCase" é feito
 * por scripts/registrar-verificacao.cjs.
 *
 * Pré-requisitos: ambiente recém-criado com ADMIN_EMAIL_INICIAL=admin@vulncase.local e
 * ADMIN_SENHA_INICIAL=admin-senha-inicial-123.
 * Uso: node scripts/verificacao-seguranca.cjs <saida.json>
 */
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = 'https://localhost'
const SAIDA = process.argv[2] ?? 'verificacao.json'
const SENHA = 'senha-de-verificacao-1'
const resultados = []

function registrar(id, nome, aprovado, evidencias) {
  resultados.push({ id, nome, aprovado, evidencias })
  console.log(`${aprovado ? 'APROVADO' : 'FALHOU  '} ${id} ${nome}`)
  for (const e of evidencias) console.log(`         - ${e}`)
}

async function contexto(b) {
  return b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } })
}
async function entrar(p, email, senha) {
  await p.goto(BASE + '/entrar')
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', senha)
  await p.click('button[type=submit]')
  await p.waitForURL(BASE + '/')
}
async function api(p, metodo, caminho, corpo, cabecalhos = {}) {
  const r = await p.request.fetch(BASE + caminho, {
    method: metodo,
    headers: { Origin: BASE, 'Content-Type': 'application/json', ...cabecalhos },
    data: corpo === undefined ? undefined : JSON.stringify(corpo),
    failOnStatusCode: false,
  })
  const texto = await r.text()
  let json = null
  try {
    json = JSON.parse(texto)
  } catch {
    /* corpo não JSON */
  }
  return { status: r.status(), json, texto }
}

const XSS = [
  `<script>alert('xss-script')</script>`,
  `<img src=x onerror="alert('xss-img')">`,
  `"><svg onload=alert('xss-svg')>`,
  `javascript:alert('xss-js')`,
  `{{constructor.constructor('alert(1)')()}}`,
]
const XSS_TEXTO = XSS.join(' ')

;(async () => {
  // CHROMIUM_PATH permite usar um Chromium já instalado no sistema.
  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  )
  const adm = await (await contexto(b)).newPage()
  await entrar(adm, 'admin@vulncase.local', 'admin-senha-inicial-123')
  const criarUsuario = async (nome, email, papel) =>
    (await api(adm, 'POST', '/api/usuarios', { nome, email, papel, senha: SENHA })).json
  const analistaU = await criarUsuario('Ana Verificadora', 'ana.verif@lab.local', 'Analista')
  const devU = await criarUsuario('Davi Verificador', 'davi.verif@lab.local', 'Desenvolvedor')
  const ana = await (await contexto(b)).newPage()
  await entrar(ana, 'ana.verif@lab.local', SENHA)
  const davi = await (await contexto(b)).newPage()
  await entrar(davi, 'davi.verif@lab.local', SENHA)

  // ---------------- 1. XSS armazenado ----------------
  {
    const alvo = (
      await api(ana, 'POST', '/api/projetos', {
        prefixo: 'ALVO',
        nome: `Alvo ${XSS[0]}`,
        descricao: XSS_TEXTO,
        responsavelTecnicoId: analistaU.id,
      })
    ).json
    const ativo = (
      await api(ana, 'POST', `/api/projetos/${alvo.id}/ativos`, {
        nome: XSS[1],
        tipo: 'AplicacaoWeb',
        identificador: XSS[2],
        ambiente: 'Laboratorio',
      })
    ).json
    const achado = (
      await api(ana, 'POST', `/api/projetos/${alvo.id}/achados`, {
        titulo: XSS[0],
        descricao: XSS_TEXTO,
        origem: 'TesteAplicacaoWeb',
        severidade: 'Alta',
        localizacao: XSS[3],
        impacto: XSS[1],
        passosReproducao: XSS[2],
        correcaoProposta: XSS[4],
        ativoId: ativo.id,
        responsavelId: devU.id,
      })
    ).json
    await api(ana, 'POST', `/api/achados/${achado.id}/comentarios`, { texto: XSS_TEXTO })
    const alertas = []
    ana.on('dialog', async (d) => {
      alertas.push(d.message())
      await d.dismiss()
    })
    const paginas = [
      '/',
      `/projetos`,
      `/projetos/${alvo.id}`,
      `/achados?projetoId=${alvo.id}`,
      `/achados/${achado.id}`,
      `/achados/${achado.id}/editar`,
    ]
    const injetados = []
    for (const caminho of paginas) {
      await ana.goto(BASE + caminho)
      await ana.waitForLoadState('networkidle')
      const n = await ana.evaluate(() => ({
        scriptsInline: [...document.querySelectorAll('script')].filter((s) => !s.src).length,
        imgX: document.querySelectorAll('img[src="x"]').length,
        svgOnload: document.querySelectorAll('svg[onload]').length,
        linkJs: [...document.querySelectorAll('a')].filter((a) => a.href.startsWith('javascript:'))
          .length,
      }))
      if (Object.values(n).some((v) => v > 0)) injetados.push(`${caminho}: ${JSON.stringify(n)}`)
    }
    await ana.goto(`${BASE}/achados/${achado.id}`)
    const tituloVisivel = await ana.textContent('h1.titulo-achado')
    const csp = (await ana.request.get(BASE + '/', { failOnStatusCode: false })).headers()[
      'content-security-policy'
    ]
    registrar(
      'T1',
      'XSS armazenado nos campos de texto',
      alertas.length === 0 && injetados.length === 0 && tituloVisivel === XSS[0],
      [
        `Cargas em título, descrição, impacto, passos, correção, localização, comentário, nome e descrição do projeto e ativo: ${XSS.length} variações.`,
        `Páginas visitadas: ${paginas.join(', ')}.`,
        `Diálogos JavaScript disparados: ${alertas.length}; elementos injetados: ${injetados.length ? injetados.join('; ') : 'nenhum'}.`,
        `Título exibido literalmente: ${JSON.stringify(tituloVisivel)}.`,
        `CSP da aplicação: ${csp}.`,
      ],
    )
  }

  // ---------------- 2. SQL Injection nos filtros ----------------
  {
    const antes = (await api(ana, 'GET', '/api/achados?tamanhoPagina=1')).json.total
    const cargasBusca = [
      `' OR '1'='1`,
      `' OR 1=1 --`,
      `'; DROP TABLE achados; --`,
      `' UNION SELECT password_hash FROM usuarios --`,
      `'; SELECT pg_sleep(5); --`,
      `%' AND 1=(SELECT 1 FROM pg_sleep(5)) AND '%'='`,
    ]
    const busca = []
    for (const c of cargasBusca) {
      const t0 = Date.now()
      const r = await api(ana, 'GET', `/api/achados?busca=${encodeURIComponent(c)}`)
      busca.push({ carga: c, status: r.status, total: r.json?.total, ms: Date.now() - t0 })
    }
    const cargasParametros = [
      ['projetoId', `1' OR '1'='1`],
      ['status', `Aberto' OR '1'='1`],
      ['severidade', `Alta'--`],
      ['ordenarPor', `criado_em; DROP TABLE achados`],
      ['ordenarPor', `(CASE WHEN (SELECT 1)=1 THEN titulo ELSE codigo END)`],
      ['ordem', `asc, (SELECT pg_sleep(5))`],
      ['categoriaOwaspId', `1 OR 1=1`],
      ['tamanhoPagina', `100; DELETE FROM achados`],
      ['pagina', `1 UNION SELECT 1`],
      ['vencido', `true' OR '1'='1`],
      ['responsavelId', `00000000-0000-4000-8000-000000000000' OR '1'='1`],
    ]
    const parametros = []
    for (const [p, c] of cargasParametros) {
      const r = await api(ana, 'GET', `/api/achados?${p}=${encodeURIComponent(c)}`)
      parametros.push({ parametro: p, carga: c, status: r.status })
    }
    const depois = (await api(ana, 'GET', '/api/achados?tamanhoPagina=1')).json.total
    const okBusca = busca.every((x) => x.status === 200 && x.total === 0 && x.ms < 2000)
    const okParam = parametros.every((x) => x.status === 400)
    registrar(
      'T2',
      'SQL Injection nos parâmetros de filtro',
      okBusca && okParam && antes === depois,
      [
        `busca (texto livre, ${cargasBusca.length} cargas, incluindo pg_sleep(5)): ${busca.map((x) => `${x.status}/total ${x.total}/${x.ms} ms`).join('; ')}.`,
        `Parâmetros tipados (${parametros.length} cargas): ${parametros.map((x) => `${x.parametro}=${x.status}`).join(', ')}.`,
        `Total de achados antes e depois: ${antes} e ${depois}.`,
      ],
    )
  }

  // ---------------- 3. Rotas de Analista e Administrador com sessão de Desenvolvedor ----------------
  {
    const p = (
      await api(ana, 'POST', '/api/projetos', {
        prefixo: 'PERM',
        nome: 'Permissões',
        responsavelTecnicoId: analistaU.id,
      })
    ).json
    const a = (
      await api(ana, 'POST', `/api/projetos/${p.id}/achados`, {
        titulo: 'Alvo',
        descricao: 'd',
        origem: 'Outra',
        severidade: 'Baixa',
        localizacao: 'l',
        correcaoProposta: 'c',
        responsavelId: devU.id,
      })
    ).json
    const outro = (
      await api(ana, 'POST', `/api/projetos/${p.id}/achados`, {
        titulo: 'De outra pessoa',
        descricao: 'd',
        origem: 'Outra',
        severidade: 'Baixa',
        localizacao: 'l',
        correcaoProposta: 'c',
        responsavelId: analistaU.id,
      })
    ).json
    await api(ana, 'POST', `/api/achados/${outro.id}/transicoes`, {
      destino: 'EmCorrecao',
      versao: outro.versao,
    })
    const chamadas = [
      ['GET', '/api/usuarios'],
      [
        'POST',
        '/api/usuarios',
        { nome: 'Invasor', email: 'x@x.local', papel: 'Administrador', senha: 'senha-longa-123' },
      ],
      ['PATCH', `/api/usuarios/${devU.id}`, { papel: 'Administrador' }],
      ['PATCH', `/api/usuarios/${analistaU.id}`, { ativo: false }],
      ['GET', '/api/usuarios/responsaveis'],
      ['POST', '/api/projetos', { prefixo: 'HACK', nome: 'x', responsavelTecnicoId: devU.id }],
      [
        'PUT',
        `/api/projetos/${p.id}`,
        { prefixo: 'PERM', nome: 'x', responsavelTecnicoId: devU.id },
      ],
      ['POST', `/api/projetos/${p.id}/arquivar`],
      [
        'POST',
        `/api/projetos/${p.id}/ativos`,
        { nome: 'x', tipo: 'Outro', identificador: 'x', ambiente: 'Producao' },
      ],
      [
        'POST',
        `/api/projetos/${p.id}/achados`,
        {
          titulo: 'x',
          descricao: 'd',
          origem: 'Outra',
          severidade: 'Baixa',
          localizacao: 'l',
          correcaoProposta: 'c',
        },
      ],
      [
        'PUT',
        `/api/achados/${a.id}`,
        {
          titulo: 'x',
          descricao: 'd',
          origem: 'Outra',
          severidade: 'Baixa',
          localizacao: 'l',
          correcaoProposta: 'c',
          versao: a.versao,
        },
      ],
      ['PUT', `/api/achados/${a.id}/responsavel`, { responsavelId: devU.id, versao: a.versao }],
      ['POST', `/api/achados/${a.id}/transicoes`, { destino: 'EmCorrecao', versao: a.versao }],
      [
        'POST',
        `/api/achados/${a.id}/transicoes`,
        { destino: 'FalsoPositivo', justificativa: 'x', versao: a.versao },
      ],
      [
        'POST',
        `/api/achados/${a.id}/transicoes`,
        { destino: 'RiscoAceito', justificativa: 'x', versao: a.versao },
      ],
      [
        'POST',
        `/api/achados/${outro.id}/transicoes`,
        { destino: 'AguardandoVerificacao', versao: outro.versao + 1 },
      ],
      ['POST', `/api/achados/${outro.id}/comentarios`, { texto: 'x' }],
    ]
    const resultadosChamadas = []
    for (const [m, c, corpo] of chamadas)
      resultadosChamadas.push({
        rota: `${m} ${c.replace(/[0-9a-f-]{36}/g, '{id}')}`,
        status: (await api(davi, m, c, corpo)).status,
      })
    const depoisAdmins = (await api(adm, 'GET', '/api/usuarios')).json.itens.filter(
      (u) => u.papel === 'Administrador',
    ).length
    registrar(
      'T3',
      'Rotas de Analista e Administrador chamadas com sessão de Desenvolvedor',
      resultadosChamadas.every((r) => r.status === 403) && depoisAdmins === 1,
      [
        ...resultadosChamadas.map((r) => `${r.rota} → ${r.status}`),
        `Administradores após o teste: ${depoisAdmins}.`,
      ],
    )
  }

  // ---------------- 4. Envio de .html renomeado para .png ----------------
  {
    const p = (await api(ana, 'GET', '/api/projetos')).json.itens.find((x) => x.prefixo === 'PERM')
    const a = (await api(ana, 'GET', `/api/achados?projetoId=${p.id}`)).json.itens[0]
    const enviar = async (nome, conteudo, tipo) =>
      (
        await ana.request.post(`${BASE}/api/achados/${a.id}/evidencias`, {
          headers: { Origin: BASE },
          multipart: { arquivo: { name: nome, mimeType: tipo, buffer: Buffer.from(conteudo) } },
          failOnStatusCode: false,
        })
      ).status()
    const casos = [
      ['pagina.png', '<!doctype html><script>alert(document.cookie)</script>', 'image/png'],
      ['vetor.png', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'image/png'],
      ['programa.pdf', Buffer.from([0x4d, 0x5a, 0x90, 0, 3]), 'application/pdf'],
      ['pagina.html', '<html></html>', 'text/html'],
      ['imagem.svg', '<svg/>', 'image/svg+xml'],
      ['captura.png.html', '<html></html>', 'image/png'],
    ]
    const r = []
    for (const [n, c, t] of casos) r.push({ nome: n, status: await enviar(n, c, t) })
    const lista = (await api(ana, 'GET', `/api/achados/${a.id}/evidencias`)).json.itens.length
    registrar(
      'T4',
      'Envio de .html renomeado para .png',
      r.every((x) => x.status === 415) && lista === 0,
      [...r.map((x) => `${x.nome} → ${x.status}`), `Evidências gravadas: ${lista}.`],
    )
  }

  // ---------------- 5. Requisição de alteração vinda de outra origem ----------------
  {
    const antes = (await api(adm, 'GET', '/api/projetos')).json.itens.length
    const direto = await api(
      adm,
      'POST',
      '/api/projetos',
      { prefixo: 'CSRFA', nome: 'csrf', responsavelTecnicoId: analistaU.id },
      { Origin: 'https://atacante.example' },
    )
    const semOrigem = await adm.request.fetch(BASE + '/api/projetos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ prefixo: 'CSRFB', nome: 'csrf', responsavelTecnicoId: analistaU.id }),
      failOnStatusCode: false,
    })
    // Página maliciosa em outra origem, aberta pelo administrador já autenticado.
    const ctxAdm = adm.context()
    await ctxAdm.route('https://atacante.example/**', (rota) =>
      rota.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><body>
          <form id="f" method="POST" action="${BASE}/api/projetos" enctype="text/plain">
            <input name='{"prefixo":"CSRFC","nome":"csrf","responsavelTecnicoId":"${analistaU.id}","x":"' value='"}'>
          </form>
          <script>
            fetch('${BASE}/api/projetos', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prefixo: 'CSRFD', nome: 'csrf', responsavelTecnicoId: '${analistaU.id}' }) })
              .then((r) => console.log('fetch:' + r.status)).catch(() => console.log('fetch:bloqueado pelo navegador'))
              .finally(() => setTimeout(() => document.getElementById('f').submit(), 300))
          </script></body>`,
      }),
    )
    const pag = await ctxAdm.newPage()
    const respostas = []
    let resultadoFetch = 'sem resposta'
    pag.on('console', (m) => m.text().startsWith('fetch:') && (resultadoFetch = m.text().slice(6)))
    pag.on('response', (r) => r.url().startsWith(BASE + '/api/') && respostas.push(r.status()))
    await pag.goto('https://atacante.example/premio.html')
    await pag.waitForTimeout(2500)
    const depois = (await api(adm, 'GET', '/api/projetos')).json.itens
    const criados = depois.filter((x) => x.prefixo.startsWith('CSRF')).length
    registrar(
      'T5',
      'Requisição de alteração a partir de outra origem',
      direto.status === 403 && semOrigem.status() === 403 && criados === 0,
      [
        `POST /api/projetos com Origin https://atacante.example e sessão de administrador → ${direto.status}.`,
        `POST /api/projetos sem Origin nem Sec-Fetch-Site → ${semOrigem.status()}.`,
        `Página em https://atacante.example com fetch JSON (credentials: include) → ${resultadoFetch}; formulário text/plain autoenviado → respostas da API: ${respostas.join(', ') || 'nenhuma'}.`,
        `Projetos criados pelas tentativas: ${criados} (antes ${antes}, depois ${depois.length}).`,
      ],
    )
  }

  fs.writeFileSync(
    SAIDA,
    JSON.stringify({ executadoEm: new Date().toISOString(), resultados }, null, 2),
  )
  await b.close()
  if (resultados.some((r) => !r.aprovado)) process.exitCode = 1
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
