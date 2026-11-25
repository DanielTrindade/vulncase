/**
 * Matriz de autorização (RNF06, RNF20, A09, A10): cada rota da Tabela 2 do documento 04
 * é chamada por cada papel, com banco real, e o código HTTP é comparado com a Tabela 1
 * do documento 02. Cada caso cria os próprios recursos, para não depender da ordem.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Papel } from '@vulncase/compartilhado'
import { PNG, TXT } from '../apoio/arquivos.js'
import { criarAmbienteTeste, SENHA_PADRAO, type AmbienteTeste } from '../apoio/app-teste.js'
import {
  achadoValido,
  criarAchadoApi,
  criarProjetoApi,
  prefixoUnico,
  type AchadoResposta,
} from '../apoio/fabricas.js'

type Sessao = Awaited<ReturnType<AmbienteTeste['sessaoDe']>>
const PAPEIS: Papel[] = ['Administrador', 'Analista', 'Desenvolvedor']

interface Requisicao {
  metodo: string
  caminho: string
  corpo?: unknown
  /** Envio multipart de arquivo, em vez de corpo JSON. */
  arquivo?: { nome: string; conteudo: Uint8Array }
}

interface Caso {
  /** Rota no formato do Hono, para conferir a cobertura da tabela. */
  rota: string
  descricao?: string
  esperado: Record<Papel, number>
  /** Monta a requisição; pode criar recursos. Recebe a sessão de quem vai chamar. */
  montar: (s: Sessao, papel: Papel) => Promise<Requisicao>
  /** Usa uma sessão nova para cada chamada (rotas que encerram ou alteram a sessão). */
  sessaoPropria?: boolean
}

const todos = (status: number): Record<Papel, number> => ({
  Administrador: status,
  Analista: status,
  Desenvolvedor: status,
})
const gestao = (status: number): Record<Papel, number> => ({
  Administrador: status,
  Analista: status,
  Desenvolvedor: 403,
})
const soAdmin = (status: number): Record<Papel, number> => ({
  Administrador: status,
  Analista: 403,
  Desenvolvedor: 403,
})

describe('matriz de autorização por rota e papel', () => {
  let t: AmbienteTeste
  const sessoes = {} as Record<Papel, Sessao>
  let analista: Sessao
  let outroDev: Sessao

  beforeAll(async () => {
    t = await criarAmbienteTeste()
    for (const p of PAPEIS) sessoes[p] = await t.sessaoDe(p)
    analista = sessoes.Analista
    outroDev = await t.sessaoDe('Desenvolvedor')
  })
  afterAll(async () => {
    await t.banco.encerrar()
  })

  const projeto = () => criarProjetoApi(t, analista.cookie, analista.usuario.id)
  async function achado(extra: Record<string, unknown> = {}) {
    const p = await projeto()
    return criarAchadoApi(t, analista.cookie, p.id, extra)
  }
  /** Achado "Em correção" atribuído ao desenvolvedor da matriz. */
  async function achadoEmCorrecaoDo(dev: Sessao): Promise<AchadoResposta> {
    const a = await achado({ responsavelId: dev.usuario.id })
    const res = await t.requisitar(`/api/achados/${a.id}/transicoes`, {
      metodo: 'POST',
      cookie: analista.cookie,
      corpo: { destino: 'EmCorrecao', versao: a.versao },
    })
    return (await res.json()) as AchadoResposta
  }

  const casos: Caso[] = [
    // ---------- autenticação ----------
    {
      rota: 'GET /api/auth/me',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/auth/me' }),
    },
    {
      rota: 'POST /api/auth/logout',
      esperado: todos(204),
      sessaoPropria: true,
      montar: async () => ({ metodo: 'POST', caminho: '/api/auth/logout' }),
    },
    {
      rota: 'PUT /api/auth/senha',
      esperado: todos(204),
      sessaoPropria: true,
      montar: async () => ({
        metodo: 'PUT',
        caminho: '/api/auth/senha',
        corpo: { senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha-da-matriz' },
      }),
    },
    // ---------- usuários ----------
    {
      rota: 'GET /api/usuarios',
      esperado: soAdmin(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/usuarios' }),
    },
    {
      rota: 'POST /api/usuarios',
      esperado: soAdmin(201),
      montar: async () => ({
        metodo: 'POST',
        caminho: '/api/usuarios',
        corpo: {
          nome: 'Novo',
          email: `novo.${crypto.randomUUID()}@teste.local`,
          papel: 'Administrador',
          senha: 'senha-longa-123',
        },
      }),
    },
    {
      rota: 'PATCH /api/usuarios/:id',
      esperado: soAdmin(200),
      montar: async () => {
        const alvo = await t.criarUsuario('Desenvolvedor')
        return {
          metodo: 'PATCH',
          caminho: `/api/usuarios/${alvo.id}`,
          corpo: { papel: 'Administrador' },
        }
      },
    },
    {
      rota: 'GET /api/usuarios/responsaveis',
      esperado: gestao(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/usuarios/responsaveis' }),
    },
    // ---------- projetos ----------
    {
      rota: 'GET /api/projetos',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/projetos' }),
    },
    {
      rota: 'POST /api/projetos',
      esperado: gestao(201),
      montar: async () => ({
        metodo: 'POST',
        caminho: '/api/projetos',
        corpo: { prefixo: prefixoUnico(), nome: 'P', responsavelTecnicoId: analista.usuario.id },
      }),
    },
    {
      rota: 'GET /api/projetos/:id',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: `/api/projetos/${(await projeto()).id}` }),
    },
    {
      rota: 'PUT /api/projetos/:id',
      esperado: gestao(200),
      montar: async () => {
        const p = await projeto()
        return {
          metodo: 'PUT',
          caminho: `/api/projetos/${p.id}`,
          corpo: {
            prefixo: p.prefixo,
            nome: 'Renomeado',
            responsavelTecnicoId: analista.usuario.id,
          },
        }
      },
    },
    {
      rota: 'POST /api/projetos/:id/arquivar',
      esperado: gestao(200),
      montar: async () => ({
        metodo: 'POST',
        caminho: `/api/projetos/${(await projeto()).id}/arquivar`,
      }),
    },
    {
      rota: 'GET /api/projetos/:id/painel',
      esperado: todos(200),
      montar: async () => ({
        metodo: 'GET',
        caminho: `/api/projetos/${(await projeto()).id}/painel`,
      }),
    },
    {
      rota: 'POST /api/projetos/:id/achados',
      esperado: gestao(201),
      montar: async () => ({
        metodo: 'POST',
        caminho: `/api/projetos/${(await projeto()).id}/achados`,
        corpo: achadoValido(),
      }),
    },
    {
      rota: 'GET /api/projetos/:id/relatorio.csv',
      esperado: todos(200),
      montar: async () => ({
        metodo: 'GET',
        caminho: `/api/projetos/${(await projeto()).id}/relatorio.csv`,
      }),
    },
    {
      rota: 'GET /api/painel',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/painel' }),
    },
    {
      rota: 'GET /api/categorias-owasp',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/categorias-owasp' }),
    },
    // ---------- achados ----------
    {
      rota: 'GET /api/achados',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: '/api/achados' }),
    },
    {
      rota: 'GET /api/achados/:id',
      esperado: todos(200),
      montar: async () => ({ metodo: 'GET', caminho: `/api/achados/${(await achado()).id}` }),
    },
    {
      rota: 'GET /api/achados/:id/historico',
      esperado: todos(200),
      montar: async () => ({
        metodo: 'GET',
        caminho: `/api/achados/${(await achado()).id}/historico`,
      }),
    },
    {
      rota: 'PUT /api/achados/:id',
      descricao: 'mesmo sendo o responsável, Desenvolvedor não edita',
      esperado: gestao(200),
      montar: async (s) => {
        const a = await achado({ responsavelId: s.usuario.id })
        return {
          metodo: 'PUT',
          caminho: `/api/achados/${a.id}`,
          corpo: achadoValido({ titulo: 'Editado', versao: a.versao }),
        }
      },
    },
    {
      rota: 'PUT /api/achados/:id/responsavel',
      descricao: 'Desenvolvedor não atribui nem a si mesmo',
      esperado: gestao(200),
      montar: async (s) => {
        const a = await achado()
        return {
          metodo: 'PUT',
          caminho: `/api/achados/${a.id}/responsavel`,
          corpo: { responsavelId: s.usuario.id, versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'concluir correção do próprio achado (RN04)',
      esperado: todos(200),
      montar: async (s) => {
        const a = await achadoEmCorrecaoDo(s)
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'AguardandoVerificacao', versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'concluir correção de achado de outra pessoa (A17)',
      esperado: gestao(200),
      montar: async () => {
        const a = await achadoEmCorrecaoDo(outroDev)
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'AguardandoVerificacao', versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'iniciar correção',
      esperado: gestao(200),
      montar: async (s) => {
        const a = await achado({ responsavelId: s.usuario.id })
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'EmCorrecao', versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'marcar falso positivo',
      esperado: gestao(200),
      montar: async () => {
        const a = await achado()
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'FalsoPositivo', justificativa: 'Não reproduz.', versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'aceitar risco',
      esperado: soAdmin(200),
      montar: async () => {
        const a = await achado()
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: {
            destino: 'RiscoAceito',
            justificativa: 'Sistema será desligado.',
            versao: a.versao,
          },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'verificar correção (aprovar)',
      esperado: gestao(200),
      montar: async () => {
        const emCorrecao = await achadoEmCorrecaoDo(outroDev)
        const res = await t.requisitar(`/api/achados/${emCorrecao.id}/transicoes`, {
          metodo: 'POST',
          cookie: outroDev.cookie,
          corpo: { destino: 'AguardandoVerificacao', versao: emCorrecao.versao },
        })
        const a = (await res.json()) as AchadoResposta
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'Corrigido', versao: a.versao },
        }
      },
    },
    {
      rota: 'POST /api/achados/:id/transicoes',
      descricao: 'reabrir achado encerrado',
      esperado: gestao(200),
      montar: async () => {
        const a0 = await achado()
        const res = await t.requisitar(`/api/achados/${a0.id}/transicoes`, {
          metodo: 'POST',
          cookie: analista.cookie,
          corpo: { destino: 'FalsoPositivo', justificativa: 'x', versao: a0.versao },
        })
        const a = (await res.json()) as AchadoResposta
        return {
          metodo: 'POST',
          caminho: `/api/achados/${a.id}/transicoes`,
          corpo: { destino: 'Aberto', justificativa: 'Voltou a ocorrer.', versao: a.versao },
        }
      },
    },
    // ---------- evidências ----------
    {
      rota: 'GET /api/achados/:id/evidencias',
      esperado: todos(200),
      montar: async () => ({
        metodo: 'GET',
        caminho: `/api/achados/${(await achado()).id}/evidencias`,
      }),
    },
    {
      rota: 'POST /api/achados/:id/evidencias',
      descricao: 'no achado atribuído a si',
      esperado: todos(201),
      montar: async (s) => ({
        metodo: 'POST',
        caminho: `/api/achados/${(await achado({ responsavelId: s.usuario.id })).id}/evidencias`,
        arquivo: { nome: 'log.txt', conteudo: TXT },
      }),
    },
    {
      rota: 'POST /api/achados/:id/evidencias',
      descricao: 'em achado de outra pessoa',
      esperado: gestao(201),
      montar: async () => ({
        metodo: 'POST',
        caminho: `/api/achados/${(await achado({ responsavelId: outroDev.usuario.id })).id}/evidencias`,
        arquivo: { nome: 'tela.png', conteudo: PNG },
      }),
    },
    {
      rota: 'GET /api/evidencias/:id/download',
      esperado: todos(200),
      montar: async () => ({
        metodo: 'GET',
        caminho: `/api/evidencias/${(await evidenciaDe(analista)).id}/download`,
      }),
    },
    {
      rota: 'DELETE /api/evidencias/:id',
      descricao: 'evidência enviada pela própria pessoa',
      esperado: todos(204),
      montar: async (s) => ({
        metodo: 'DELETE',
        caminho: `/api/evidencias/${(await evidenciaDe(s)).id}`,
      }),
    },
    {
      rota: 'DELETE /api/evidencias/:id',
      descricao: 'evidência enviada por outra pessoa',
      esperado: gestao(204),
      montar: async () => ({
        metodo: 'DELETE',
        caminho: `/api/evidencias/${(await evidenciaDe(outroDev)).id}`,
      }),
    },
  ]

  /** Evidência enviada pela sessão informada, num achado atribuído a ela. */
  async function evidenciaDe(s: Sessao): Promise<{ id: string }> {
    const a = await achado({
      responsavelId: s.usuario.papel === 'Desenvolvedor' ? s.usuario.id : null,
    })
    const res = await t.enviarArquivo(`/api/achados/${a.id}/evidencias`, s.cookie, {
      nome: 'log.txt',
      conteudo: TXT,
    })
    return (await res.json()) as { id: string }
  }

  for (const caso of casos) {
    describe(`${caso.rota}${caso.descricao ? ` — ${caso.descricao}` : ''}`, () => {
      it.each(PAPEIS)('%s', async (papel) => {
        const sessao = caso.sessaoPropria ? await t.sessaoDe(papel) : sessoes[papel]
        const req = await caso.montar(sessao, papel)
        const res = req.arquivo
          ? await t.enviarArquivo(req.caminho, sessao.cookie, req.arquivo)
          : await t.requisitar(req.caminho, {
              metodo: req.metodo,
              cookie: sessao.cookie,
              corpo: req.corpo,
            })
        const esperado = caso.esperado[papel]
        expect(
          res.status,
          `${papel} ${req.metodo} ${req.caminho}: ${res.status === esperado ? '' : await res.text()}`,
        ).toBe(esperado)
      })
    })
  }

  it('toda rota registrada na aplicação tem casos para os três papéis', () => {
    const publicas = new Set(['GET /api/health', 'POST /api/auth/login'])
    const registradas = t.app.routes
      .filter((r) => r.path.startsWith('/api/') && r.method !== 'ALL' && !r.path.endsWith('*'))
      .map((r) => `${r.method} ${r.path}`)
      .filter((r) => !publicas.has(r))
    const cobertas = new Set(casos.map((c) => c.rota))
    for (const rota of registradas) expect(cobertas.has(rota), rota).toBe(true)
  })

  describe('sem sessão e com origem inválida', () => {
    const mutaveis = casos.filter((c) => !c.rota.startsWith('GET'))

    it.each(casos.map((c) => [c.rota, c] as const))(
      '%s sem sessão retorna 401',
      async (_r, caso) => {
        const req = await caso.montar(sessoes.Administrador, 'Administrador')
        const res = await t.requisitar(req.caminho, { metodo: req.metodo, corpo: req.corpo })
        expect(res.status).toBe(401)
      },
    )

    it.each(mutaveis.map((c) => [c.rota, c] as const))(
      '%s de outra origem retorna 403, mesmo com sessão de administrador',
      async (_r, caso) => {
        const req = await caso.montar(sessoes.Administrador, 'Administrador')
        const res = await t.requisitar(req.caminho, {
          metodo: req.metodo,
          corpo: req.corpo,
          cookie: sessoes.Administrador.cookie,
          cabecalhos: { Origin: 'https://atacante.example' },
        })
        expect(res.status).toBe(403)
      },
    )
  })
})
