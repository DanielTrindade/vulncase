import { eq, inArray, sql } from 'drizzle-orm'
import {
  esquemaCriarAchado,
  type FormularioCriarAchado,
  type Papel,
  type StatusAchado,
} from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { Log } from '../infra/log.js'
import { gerarHash } from '../infra/senha.js'
import { alterarResponsavel, executarTransicao, registrarAchado } from '../servicos/achados.js'
import type { BancoDados } from './cliente.js'
import { achados, projetos, usuarios } from './schema.js'

/**
 * Carga de demonstração (RNF19, documento 06, seção 3). Os achados são criados pelos
 * próprios serviços da aplicação, de modo que códigos, transições e histórico seguem
 * exatamente as regras do sistema. Todos os dados são fictícios ou de laboratório.
 */

export const SENHA_DEMONSTRACAO_PADRAO = 'demo-vulncase-2026'

const USUARIOS: { chave: string; nome: string; email: string; papel: Papel }[] = [
  {
    chave: 'admin',
    nome: 'Alice Administradora',
    email: 'admin@demo.vulncase.local',
    papel: 'Administrador',
  },
  {
    chave: 'analista',
    nome: 'Bruno Analista',
    email: 'analista@demo.vulncase.local',
    papel: 'Analista',
  },
  {
    chave: 'dev',
    nome: 'Carla Desenvolvedora',
    email: 'dev@demo.vulncase.local',
    papel: 'Desenvolvedor',
  },
]

const PROJETOS = [
  {
    prefixo: 'REDE',
    nome: 'Laboratório de redes',
    descricao:
      'Atividades de análise de tráfego e varredura da disciplina de Segurança de Redes, no segmento 10.0.0.0/24 do laboratório.',
  },
  {
    prefixo: 'WEB',
    nome: 'Aplicação web de teste',
    descricao:
      'Aplicação deliberadamente vulnerável (OWASP Juice Shop) executada localmente em http://localhost:3001 para as atividades de Segurança de Aplicações Web.',
  },
  {
    prefixo: 'COD',
    nome: 'Revisão de código',
    descricao:
      'Trechos de código revisados pela equipe na disciplina de Projeto e Desenvolvimento de Código Seguro.',
  },
] as const

type Passo =
  | { atribuir: 'dev' | null }
  | { para: StatusAchado; por: 'admin' | 'analista' | 'dev'; justificativa?: string }

interface AchadoDemo {
  projeto: (typeof PROJETOS)[number]['prefixo']
  dados: Omit<FormularioCriarAchado, 'responsavelId'>
  passos: Passo[]
  /** Dias em relação a hoje (negativo = no passado). */
  dataLimiteDias?: number
}

const A = { A01: 1, A02: 2, A03: 3, A05: 5, A07: 7, A09: 9 }

const ACHADOS: AchadoDemo[] = [
  // ---------------- REDE ----------------
  {
    projeto: 'REDE',
    dados: {
      titulo: 'Credenciais trafegam em texto claro via Telnet',
      descricao:
        'O serviço Telnet do roteador do laboratório aceita autenticação sem criptografia.',
      origem: 'AnaliseRede',
      severidade: 'Alta',
      localizacao: '10.0.0.15:23/tcp',
      impacto: 'Qualquer nó no mesmo segmento captura usuário e senha de administração.',
      passosReproducao:
        '1. Iniciar captura no Wireshark na interface do laboratório.\n2. Autenticar via Telnet.\n3. Seguir o fluxo TCP da sessão.',
      correcaoProposta: 'Desativar o Telnet e usar SSH com autenticação por chave.',
      categoriaOwaspId: A.A02,
      cweId: 319,
    },
    passos: [
      { atribuir: 'dev' },
      { para: 'EmCorrecao', por: 'analista' },
      {
        para: 'AguardandoVerificacao',
        por: 'dev',
        justificativa: 'Telnet desativado; SSH habilitado só com chave.',
      },
      {
        para: 'Corrigido',
        por: 'analista',
        justificativa: 'Nova varredura não encontrou a porta 23 aberta.',
      },
    ],
    dataLimiteDias: -20,
  },
  {
    projeto: 'REDE',
    dados: {
      titulo: 'Formulário de autenticação servido por HTTP sem TLS',
      descricao: 'O painel web da impressora de rede recebe usuário e senha por HTTP.',
      origem: 'AnaliseRede',
      severidade: 'Critica',
      localizacao: 'http://10.0.0.40/login',
      impacto: 'Captura das credenciais de administração por escuta passiva.',
      correcaoProposta: 'Habilitar HTTPS com certificado válido e redirecionar a porta 80.',
      categoriaOwaspId: A.A02,
      cweId: 319,
    },
    passos: [{ atribuir: 'dev' }, { para: 'EmCorrecao', por: 'analista' }],
    dataLimiteDias: -3,
  },
  {
    projeto: 'REDE',
    dados: {
      titulo: 'Serviço PostgreSQL exposto para toda a rede',
      descricao: 'A porta 5432 do servidor de banco responde a qualquer host do segmento.',
      origem: 'AnaliseRede',
      severidade: 'Alta',
      localizacao: '10.0.0.22:5432/tcp',
      impacto: 'Ataques de força bruta e exploração direta do serviço de banco.',
      passosReproducao: 'nmap -sV -p 5432 10.0.0.0/24',
      correcaoProposta:
        'Restringir listen_addresses e pg_hba.conf ao servidor de aplicação; aplicar regra de firewall.',
      categoriaOwaspId: A.A05,
      cweId: 284,
    },
    passos: [],
    dataLimiteDias: -10,
  },
  {
    projeto: 'REDE',
    dados: {
      titulo: 'SNMP v2c com comunidade padrão "public"',
      descricao: 'O switch gerenciável responde a consultas SNMP com a comunidade padrão.',
      origem: 'AnaliseRede',
      severidade: 'Media',
      localizacao: '10.0.0.2:161/udp',
      correcaoProposta: 'Migrar para SNMPv3 com autenticação e privacidade.',
      categoriaOwaspId: A.A07,
      cweId: 1392,
    },
    passos: [
      {
        para: 'RiscoAceito',
        por: 'admin',
        justificativa: 'Switch isolado em VLAN de gerência e substituído no próximo semestre.',
      },
    ],
  },
  // ---------------- WEB ----------------
  {
    projeto: 'WEB',
    dados: {
      titulo: 'SQL Injection no formulário de login',
      descricao:
        "O campo de e-mail é concatenado na consulta; a carga ' OR 1=1-- autentica como o primeiro usuário.",
      origem: 'TesteAplicacaoWeb',
      severidade: 'Critica',
      localizacao: 'POST /rest/user/login (campo email)',
      impacto: 'Acesso a qualquer conta, inclusive a de administrador, sem senha.',
      passosReproducao:
        "1. Abrir a tela de login.\n2. Informar ' OR 1=1-- no e-mail e qualquer senha.\n3. Observar a autenticação como admin.",
      correcaoProposta: 'Usar consultas parametrizadas e validar o formato do e-mail no servidor.',
      categoriaOwaspId: A.A03,
      cweId: 89,
      notaCvss: 9.8,
    },
    passos: [
      { atribuir: 'dev' },
      { para: 'EmCorrecao', por: 'analista' },
      {
        para: 'AguardandoVerificacao',
        por: 'dev',
        justificativa: 'Consulta reescrita com parâmetros.',
      },
    ],
    dataLimiteDias: 2,
  },
  {
    projeto: 'WEB',
    dados: {
      titulo: 'XSS refletido no parâmetro de busca',
      descricao: 'O termo buscado é inserido na página sem codificação.',
      origem: 'TesteAplicacaoWeb',
      severidade: 'Media',
      localizacao: 'GET /#/search?q=',
      impacto: 'Execução de script no navegador da vítima que abrir um link preparado.',
      passosReproducao: 'Acessar /#/search?q=<iframe src="javascript:alert(1)">',
      correcaoProposta: 'Codificar a saída conforme o contexto e adotar Content-Security-Policy.',
      categoriaOwaspId: A.A03,
      cweId: 79,
    },
    passos: [{ atribuir: 'dev' }, { para: 'EmCorrecao', por: 'analista' }],
    dataLimiteDias: 60,
  },
  {
    projeto: 'WEB',
    dados: {
      titulo: 'Rota administrativa acessível sem autorização',
      descricao: 'A página de administração não verifica o papel do usuário autenticado.',
      origem: 'TesteAplicacaoWeb',
      severidade: 'Alta',
      localizacao: '/#/administration',
      impacto: 'Usuário comum lista e exclui dados de outros clientes.',
      correcaoProposta: 'Verificar o papel no servidor em todas as rotas administrativas.',
      categoriaOwaspId: A.A01,
      cweId: 862,
    },
    passos: [{ atribuir: 'dev' }],
    dataLimiteDias: 25,
  },
  {
    projeto: 'WEB',
    dados: {
      titulo: 'Versão do servidor exposta no cabeçalho Server',
      descricao: 'As respostas incluem o cabeçalho Server com nome e versão do servidor.',
      origem: 'TesteAplicacaoWeb',
      severidade: 'Informativa',
      localizacao: 'Cabeçalho HTTP Server',
      correcaoProposta: 'Remover ou generalizar o cabeçalho Server no proxy.',
      categoriaOwaspId: A.A05,
      cweId: 200,
    },
    passos: [],
  },
  // ---------------- COD ----------------
  {
    projeto: 'COD',
    dados: {
      titulo: 'Chave de API hardcoded no código-fonte',
      descricao: 'A chave do serviço de e-mail está escrita em config.js e versionada.',
      origem: 'RevisaoCodigo',
      severidade: 'Alta',
      localizacao: 'src/config.js:12',
      impacto: 'Qualquer pessoa com acesso ao repositório usa a chave.',
      correcaoProposta:
        'Ler a chave de variável de ambiente, revogar a chave exposta e limpar o histórico.',
      categoriaOwaspId: A.A07,
      cweId: 798,
    },
    passos: [
      { atribuir: 'dev' },
      { para: 'EmCorrecao', por: 'analista' },
      {
        para: 'AguardandoVerificacao',
        por: 'dev',
        justificativa: 'Chave movida para variável de ambiente.',
      },
      {
        para: 'EmCorrecao',
        por: 'analista',
        justificativa: 'A chave antiga ainda não foi revogada no provedor.',
      },
      { para: 'AguardandoVerificacao', por: 'dev', justificativa: 'Chave revogada e substituída.' },
      { para: 'Corrigido', por: 'analista' },
    ],
  },
  {
    projeto: 'COD',
    dados: {
      titulo: 'Senhas armazenadas sem hash',
      descricao: 'A tabela de usuários guarda a senha em texto claro.',
      origem: 'RevisaoCodigo',
      severidade: 'Critica',
      localizacao: 'src/usuarios/repositorio.js:48',
      impacto: 'Um vazamento do banco expõe as senhas de todos os usuários.',
      correcaoProposta: 'Armazenar hash Argon2id com sal e migrar as senhas no próximo login.',
      categoriaOwaspId: A.A02,
      cweId: 256,
    },
    passos: [],
    dataLimiteDias: -1,
  },
  {
    projeto: 'COD',
    dados: {
      titulo: 'Validação de entrada ausente no cadastro de produtos',
      descricao: 'O preço do produto não é validado no servidor.',
      origem: 'RevisaoCodigo',
      severidade: 'Baixa',
      localizacao: 'src/produtos/controlador.js:31',
      correcaoProposta: 'Validar tipo e faixa no servidor.',
      categoriaOwaspId: A.A03,
      cweId: 20,
    },
    passos: [
      {
        para: 'FalsoPositivo',
        por: 'analista',
        justificativa: 'O middleware de validação global já rejeita valores fora da faixa.',
      },
    ],
  },
  {
    projeto: 'COD',
    dados: {
      titulo: 'Token de sessão registrado no log',
      descricao: 'O log de depuração imprime o cabeçalho Authorization completo.',
      origem: 'RevisaoCodigo',
      severidade: 'Baixa',
      localizacao: 'src/middlewares/log.js:9',
      correcaoProposta: 'Remover cabeçalhos sensíveis do log.',
      categoriaOwaspId: A.A09,
      cweId: 532,
    },
    passos: [
      { atribuir: 'dev' },
      { para: 'EmCorrecao', por: 'analista' },
      { para: 'AguardandoVerificacao', por: 'dev' },
      { para: 'Corrigido', por: 'analista' },
      {
        para: 'Aberto',
        por: 'analista',
        justificativa: 'O novo módulo de auditoria voltou a registrar o token.',
      },
    ],
    dataLimiteDias: -5,
  },
]

function diaRelativo(dias: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export async function carregarDemonstracao(
  db: BancoDados,
  log: Log,
  senha: string = SENHA_DEMONSTRACAO_PADRAO,
): Promise<'carregado' | 'existente'> {
  const existentes = await db
    .select({ prefixo: projetos.prefixo })
    .from(projetos)
    .where(
      inArray(
        projetos.prefixo,
        PROJETOS.map((p) => p.prefixo),
      ),
    )
  if (existentes.length > 0) {
    log.info({ prefixos: existentes.map((e) => e.prefixo) }, 'dados de demonstração já carregados')
    return 'existente'
  }

  // Usuários: reaproveita se já existirem (ex.: segunda carga após limpar projetos).
  const hash = await gerarHash(senha)
  const pessoas = {} as Record<string, UsuarioSessao>
  for (const u of USUARIOS) {
    const [linha] = await db
      .insert(usuarios)
      .values({ nome: u.nome, email: u.email, papel: u.papel, passwordHash: hash })
      .onConflictDoNothing()
      .returning()
    const atual =
      linha ??
      (
        await db
          .select()
          .from(usuarios)
          .where(eq(sql`lower(${usuarios.email})`, u.email))
      )[0]!
    pessoas[u.chave] = { id: atual.id, nome: atual.nome, email: atual.email, papel: atual.papel }
  }
  const analista = pessoas.analista!

  const idsProjeto = {} as Record<string, string>
  for (const p of PROJETOS) {
    const [linha] = await db
      .insert(projetos)
      .values({ ...p, responsavelTecnicoId: analista.id })
      .returning({ id: projetos.id })
    idsProjeto[p.prefixo] = linha!.id
  }

  for (const a of ACHADOS) {
    // Os dados de demonstração passam pela mesma validação da API.
    const entrada = esquemaCriarAchado.parse({ ...a.dados, responsavelId: null })
    let atual = await registrarAchado(db, log, analista, idsProjeto[a.projeto]!, entrada)
    for (const passo of a.passos) {
      if ('atribuir' in passo) {
        const id = passo.atribuir ? pessoas[passo.atribuir]!.id : null
        atual = await alterarResponsavel(db, log, analista, atual.id, {
          responsavelId: id,
          versao: atual.versao,
        })
      } else {
        atual = await executarTransicao(db, log, pessoas[passo.por]!, atual.id, {
          destino: passo.para,
          justificativa: passo.justificativa ?? null,
          versao: atual.versao,
        })
      }
    }
    if (a.dataLimiteDias !== undefined) {
      await db
        .update(achados)
        .set({ dataLimite: diaRelativo(a.dataLimiteDias) })
        .where(eq(achados.id, atual.id))
    }
  }

  log.info(
    { usuarios: USUARIOS.length, projetos: PROJETOS.length, achados: ACHADOS.length },
    'dados de demonstração carregados',
  )
  return 'carregado'
}
