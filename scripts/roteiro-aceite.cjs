/**
 * Roteiro dos critérios de aceite do MVP (docs/01-visao-e-escopo.md, seção 10),
 * executado pela interface em https://localhost com o Playwright.
 *
 * Pré-requisitos: ambiente recém-criado (`docker compose down -v && docker compose up`)
 * com ADMIN_EMAIL_INICIAL=admin@vulncase.local e ADMIN_SENHA_INICIAL=admin-senha-inicial-123.
 * Uso: pnpm aceite   (as capturas são gravadas em docs/aceite)
 */
const { chromium } = require('playwright')
const BASE = 'https://localhost'
const DIR = process.argv[2] ?? 'docs/aceite'
const resultado = []
function passo(n, ok, detalhe) {
  resultado.push({ n, ok, detalhe })
  console.log(`PASSO ${n}: ${ok ? 'OK' : 'FALHOU'} — ${detalhe}`)
}
async function foto(p, nome) {
  await p.screenshot({ path: `${DIR}/${nome}.jpg`, type: 'jpeg', quality: 80, fullPage: true })
}
async function novoContexto(b) {
  return b.newContext({
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 800 },
  })
}
async function entrar(p, email, senha) {
  await p.goto(BASE + '/entrar')
  await p.fill('input[type=email]', email)
  await p.fill('input[type=password]', senha)
  await p.click('button[type=submit]')
  await p.waitForURL(BASE + '/')
}
async function cadastrarUsuario(p, nome, email, papel) {
  await p.getByRole('button', { name: 'Novo usuário' }).click()
  const d = p.getByRole('dialog')
  await d.getByLabel(/^Nome/).fill(nome)
  await d.getByLabel(/^E-mail/).fill(email)
  await d.locator('select[name=papel]').selectOption(papel)
  await d.getByLabel('Senha inicial').fill('senha-inicial-123')
  await d.getByRole('button', { name: 'Cadastrar usuário' }).click()
  await p.getByText(`Usuário ${nome} cadastrado`).waitFor()
  await d.waitFor({ state: 'hidden' })
}
async function registrar(p, projetoId, a) {
  await p.goto(`${BASE}/projetos/${projetoId}/achados/novo`)
  await p.getByLabel(/^Título/).fill(a.titulo)
  await p.getByLabel('Origem').selectOption(a.origem)
  await p.getByLabel('Severidade').selectOption(a.severidade)
  await p.getByLabel('Localização').fill(a.localizacao)
  await p.getByLabel('Categoria OWASP Top 10').selectOption(String(a.owasp))
  await p.getByLabel('CWE').fill(String(a.cwe))
  await p.getByLabel(/^Descrição/).fill(a.descricao)
  await p.getByLabel('Correção proposta').fill(a.correcao)
  await p.click('button:has-text("Registrar achado")')
  await p.waitForURL(/\/achados\/[0-9a-f-]{36}$/)
  await p.waitForSelector('h1.titulo-achado')
  return {
    id: p.url().split('/').pop(),
    codigo: (await p.textContent('[data-testid=codigo-achado]')).trim(),
  }
}
async function transicionar(p, id, rotulo, justificativa) {
  await p.goto(`${BASE}/achados/${id}`)
  await p.click(`[data-testid=acoes-achado] button:has-text("${rotulo}")`)
  const d = p.getByRole('dialog')
  if (justificativa) await d.locator('textarea').fill(justificativa)
  await d.getByRole('button', { name: 'Confirmar' }).click()
  await d.waitFor({ state: 'hidden' })
}
const MENU = 'nav[aria-label="Navegação principal"] a'
const ACOES = '[data-testid=acoes-achado] button, [data-testid=acoes-achado] a'
/** Selo de status no cabeçalho do achado. */
const status = (s) => `header [data-status=${s}]`
const ACHADOS = [
  {
    titulo: 'Credenciais em texto claro via Telnet',
    origem: 'AnaliseRede',
    severidade: 'Alta',
    localizacao: '10.0.0.15:23/tcp',
    owasp: 2,
    cwe: 319,
    descricao: 'Telnet aceita autenticação sem criptografia.',
    correcao: 'Desativar Telnet e usar SSH.',
  },
  {
    titulo: 'Serviço de banco exposto na rede',
    origem: 'AnaliseRede',
    severidade: 'Media',
    localizacao: '10.0.0.22:5432/tcp',
    owasp: 5,
    cwe: 284,
    descricao: 'PostgreSQL responde a qualquer host.',
    correcao: 'Restringir por firewall e pg_hba.conf.',
  },
  {
    titulo: 'SQL Injection no login',
    origem: 'TesteAplicacaoWeb',
    severidade: 'Critica',
    localizacao: 'POST /rest/user/login',
    owasp: 3,
    cwe: 89,
    descricao: 'Campo e-mail concatenado na consulta.',
    correcao: 'Consultas parametrizadas.',
  },
  {
    titulo: 'XSS refletido na busca',
    origem: 'TesteAplicacaoWeb',
    severidade: 'Media',
    localizacao: '/#/search?q=',
    owasp: 3,
    cwe: 79,
    descricao: 'Termo buscado inserido sem codificação.',
    correcao: 'Codificar a saída.',
  },
  {
    titulo: 'Segredo hardcoded no código',
    origem: 'RevisaoCodigo',
    severidade: 'Baixa',
    localizacao: 'src/config.js:12',
    owasp: 7,
    cwe: 798,
    descricao: 'Chave de API versionada.',
    correcao: 'Usar variável de ambiente e revogar a chave.',
  },
]
;(async () => {
  // CHROMIUM_PATH permite usar um Chromium já instalado no sistema.
  const b = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  )
  // 1
  const adm = await (await novoContexto(b)).newPage()
  await entrar(adm, 'admin@vulncase.local', 'admin-senha-inicial-123')
  await adm.click(`${MENU}:has-text("Usuários")`)
  await cadastrarUsuario(adm, 'Ana Analista', 'ana@lab.local', 'Analista')
  await cadastrarUsuario(adm, 'Davi Desenvolvedor', 'davi@lab.local', 'Desenvolvedor')
  await foto(adm, '01-usuarios-cadastrados')
  const linhas = await adm.locator('tbody tr').count()
  passo(
    1,
    linhas === 3,
    `administrador entrou e cadastrou analista e desenvolvedor (${linhas} usuários na lista)`,
  )

  // 2
  const ana = await (await novoContexto(b)).newPage()
  await entrar(ana, 'ana@lab.local', 'senha-inicial-123')
  await ana.click(`${MENU}:has-text("Projetos")`)
  await ana.getByRole('link', { name: 'Novo projeto' }).click()
  await ana.getByLabel(/^Prefixo/).fill('LAB')
  await ana.getByLabel(/^Nome/).fill('Laboratório integrado')
  await ana.getByLabel(/^Descrição/).fill('Achados de rede, aplicação web e revisão de código.')
  await ana.getByRole('button', { name: 'Criar projeto' }).click()
  await ana.waitForURL(/\/projetos\/[0-9a-f-]{36}$/)
  const projetoId = ana.url().split('/').pop()
  const reg = []
  for (const a of ACHADOS) reg.push(await registrar(ana, projetoId, a))
  await ana.goto(`${BASE}/achados?projetoId=${projetoId}`)
  await ana.waitForSelector('tbody tr')
  await foto(ana, '02-cinco-achados-registrados')
  passo(
    2,
    reg.length === 5 && (await ana.locator('tbody tr').count()) === 5,
    `analista criou o projeto LAB e registrou ${reg.map((r) => r.codigo).join(', ')}`,
  )

  // 3
  for (const r of [reg[0], reg[2]]) {
    await ana.goto(`${BASE}/achados/${r.id}`)
    await ana.getByRole('combobox', { name: 'Responsável' }).click()
    await ana.getByRole('option', { name: 'Davi Desenvolvedor' }).click()
    await ana.getByText('Atribuído a Davi Desenvolvedor').first().waitFor()
    await ana.waitForSelector('[data-testid=acoes-achado] button:has-text("Iniciar correção")')
    await transicionar(ana, r.id, 'Iniciar correção')
    await ana.waitForSelector(status('EmCorrecao'))
  }
  await ana.goto(`${BASE}/achados?projetoId=${projetoId}&status=EmCorrecao`)
  await ana.waitForSelector('tbody tr')
  await foto(ana, '03-dois-em-correcao')
  passo(
    3,
    (await ana.locator('tbody tr').count()) === 2,
    `${reg[0].codigo} e ${reg[2].codigo} atribuídos a Davi e em correção`,
  )

  // 4
  const davi = await (await novoContexto(b)).newPage()
  await entrar(davi, 'davi@lab.local', 'senha-inicial-123')
  const menu = (await davi.locator(MENU).allTextContents()).join(',')
  await davi.goto(`${BASE}/achados/${reg[1].id}`)
  await davi.waitForSelector('h1.titulo-achado')
  const acoesOutro = await davi.locator(ACOES).count()
  await davi.goto(`${BASE}/achados/${reg[0].id}`)
  await davi.waitForSelector('h1.titulo-achado')
  const acoesProprio = (await davi.locator(ACOES).allTextContents()).join(',')
  await foto(davi, '04a-desenvolvedor-acoes-permitidas')
  await transicionar(davi, reg[0].id, 'Concluir correção', 'Telnet desativado; SSH com chave.')
  await davi.waitForSelector(status('AguardandoVerificacao'))
  await foto(davi, '04b-aguardando-verificacao')
  passo(
    4,
    menu === 'Painel,Achados,Projetos' && acoesOutro === 0 && acoesProprio === 'Concluir correção',
    `menu do desenvolvedor: ${menu}; ações em achado não atribuído: ${acoesOutro}; no próprio: ${acoesProprio}; ${reg[0].codigo} movido para Aguardando verificação`,
  )

  // 5
  await transicionar(ana, reg[0].id, 'Aprovar verificação')
  await ana.waitForSelector(status('Corrigido'))
  await transicionar(
    ana,
    reg[1].id,
    'Marcar falso positivo',
    'A porta 5432 só responde à VLAN de gerência; a varredura foi feita de dentro dela.',
  )
  await ana.waitForSelector(status('FalsoPositivo'))
  await foto(ana, '05-falso-positivo')
  passo(
    5,
    true,
    `${reg[0].codigo} encerrado como Corrigido; ${reg[1].codigo} marcado como Falso positivo com justificativa`,
  )

  // 6
  await ana.goto(`${BASE}/projetos/${projetoId}`)
  await ana.waitForSelector('[data-segmento]')
  await ana.waitForTimeout(800) // fim da animação de revelação da faixa
  const texto = async (sel) => (await ana.locator(sel).first().innerText()).trim()
  // total, abertos, sem responsável, vencidos
  const valores = [
    await texto('[data-testid=total-registrados]'),
    await texto('[data-testid=total-abertos]'),
    (await texto('[data-pendencia=sem-responsavel]')).match(/\d+/)[0],
    (await texto('[data-pendencia=vencidos]')).match(/\d+/)[0],
  ]
  const painel = await (await ana.request.get(`${BASE}/api/projetos/${projetoId}/painel`)).json()
  const esperadoSev = { Critica: 1, Alta: 1, Media: 2, Baixa: 1, Informativa: 0 }
  const esperadoStatus = {
    Aberto: 2,
    EmCorrecao: 1,
    AguardandoVerificacao: 0,
    Corrigido: 1,
    FalsoPositivo: 1,
    RiscoAceito: 0,
  }
  // legenda da faixa de severidade (abertos) e etapas do ciclo de correção
  const legenda = await ana
    .locator('ul [data-severidade]')
    .evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  const ciclo = await ana
    .locator('[data-etapa]')
    .evaluateAll((els) => els.map((e) => `${e.dataset.etapa} ${e.innerText.trim()}`))
  const tabelaUi = [...legenda, ...ciclo]
  await foto(ana, '06-painel-do-projeto')
  const ok6 =
    JSON.stringify(painel.porSeveridade) === JSON.stringify(esperadoSev) &&
    JSON.stringify(painel.porStatus) === JSON.stringify(esperadoStatus) &&
    valores.join(',') === '5,3,2,0' &&
    legenda.join(',') === 'Crítica 1,Alta 0,Média 1,Baixa 1,Informativa 0' &&
    ciclo.join(',') === 'Aberto 2,Em correção 1,Aguardando verificação 0,Encerrados 2'
  passo(
    6,
    ok6,
    `indicadores ${valores.join(',')} (total, abertos, sem responsável, vencidos); severidade ${JSON.stringify(painel.porSeveridade)}; status ${JSON.stringify(painel.porStatus)}; na tela: ${tabelaUi.join(' | ')}`,
  )

  // 7
  await ana.goto(`${BASE}/achados/${reg[0].id}`)
  await ana.waitForFunction(() => document.querySelectorAll('.linha-tempo__item').length >= 5)
  const hist = await ana
    .locator('.linha-tempo__item')
    .evaluateAll((els) => els.map((e) => e.innerText.replace(/\n+/g, ' ')))
  await foto(ana, '07-historico-do-encerrado')
  const temTudo = [
    'Aberto para Em correção',
    'Em correção para Aguardando verificação',
    'Aguardando verificação para Corrigido',
  ].every((t) => hist.some((h) => h.includes(t)))
  passo(7, temTudo && hist.every((h) => /\d{2}\/\d{2}\/\d{4}/.test(h)), hist.join(' || '))

  // 8
  const r1 = await davi.request.post(`${BASE}/api/achados/${reg[3].id}/transicoes`, {
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      destino: 'FalsoPositivo',
      justificativa: 'tentativa direta',
      versao: 1,
    }),
  })
  const r2 = await davi.request.post(`${BASE}/api/projetos`, {
    headers: { Origin: BASE, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      prefixo: 'HACK',
      nome: 'x',
      responsavelTecnicoId: (await (await davi.request.get(`${BASE}/api/auth/me`)).json()).usuario
        .id,
    }),
  })
  passo(
    8,
    r1.status() === 403 && r2.status() === 403,
    `POST /api/achados/{id}/transicoes (FalsoPositivo) → ${r1.status()} ${JSON.stringify(await r1.json())}; POST /api/projetos → ${r2.status()}`,
  )

  if (resultado.some((r) => !r.ok)) process.exitCode = 1
  await b.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
