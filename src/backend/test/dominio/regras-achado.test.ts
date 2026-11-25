import { describe, expect, it } from 'vitest'
import { STATUS_ACHADO, type StatusAchado } from '@vulncase/compartilhado'
import {
  atribuirResponsavel,
  diferencasDeCampos,
  estaVencido,
  garantirNaoEncerrado,
  verificarEdicao,
  type Ator,
  type EstadoAchado,
} from '../../src/dominio/achado.js'
import {
  AcessoNegadoError,
  ConflitoError,
  ContaBloqueadaError,
  NaoAutenticadoError,
  RecursoNaoEncontradoError,
  ValidacaoError,
  VersaoDivergenteError,
} from '../../src/dominio/erros.js'
import { gerarCodigoAchado } from '../../src/dominio/projeto.js'

const analista: Ator = { id: 'u-ana', papel: 'Analista' }
const dev: Ator = { id: 'u-dev', papel: 'Desenvolvedor' }
const fulano = { id: 'u-ful', nome: 'Fulano', ativo: true }
const beltrano = { id: 'u-bel', nome: 'Beltrano', ativo: true }
const ENCERRAMENTO: StatusAchado[] = ['Corrigido', 'FalsoPositivo', 'RiscoAceito']

function achado(
  status: StatusAchado,
  resp: { id: string; nome: string } | null = null,
): EstadoAchado {
  return { status, responsavel: resp, encerradoEm: null }
}

describe('atribuirResponsavel', () => {
  it('atribui responsável e registra a troca', () => {
    const r = atribuirResponsavel(achado('Aberto'), fulano, analista)
    expect(r.achado.responsavel).toEqual({ id: 'u-ful', nome: 'Fulano' })
    expect(r.eventos).toEqual([
      {
        tipo: 'TrocaResponsavel',
        campo: 'responsavel',
        valorAnterior: null,
        valorNovo: 'Fulano',
        justificativa: null,
      },
    ])
  })

  it('troca responsável com valor anterior e novo', () => {
    const r = atribuirResponsavel(achado('EmCorrecao', fulano), beltrano, analista)
    expect(r.achado.status).toBe('EmCorrecao')
    expect(r.eventos[0]).toMatchObject({ valorAnterior: 'Fulano', valorNovo: 'Beltrano' })
  })

  it('UC06 1a: remover de achado em correção devolve a Aberto', () => {
    const r = atribuirResponsavel(achado('EmCorrecao', fulano), null, analista)
    expect(r.achado).toMatchObject({ responsavel: null, status: 'Aberto' })
    expect(r.eventos.map((e) => e.tipo)).toEqual(['TrocaResponsavel', 'Transicao'])
    expect(r.eventos[1]).toMatchObject({ valorAnterior: 'EmCorrecao', valorNovo: 'Aberto' })
  })

  it('remover de achado aberto ou aguardando verificação mantém o status', () => {
    expect(atribuirResponsavel(achado('Aberto', fulano), null, analista).achado.status).toBe(
      'Aberto',
    )
    const r = atribuirResponsavel(achado('AguardandoVerificacao', fulano), null, analista)
    expect(r.achado.status).toBe('AguardandoVerificacao')
    expect(r.eventos).toHaveLength(1)
  })

  it('sem mudança não gera evento', () => {
    expect(atribuirResponsavel(achado('Aberto', fulano), fulano, analista).eventos).toEqual([])
    expect(atribuirResponsavel(achado('Aberto'), null, analista).eventos).toEqual([])
  })

  it('RN11: usuário inativo não pode ser responsável', () => {
    expect(() =>
      atribuirResponsavel(achado('Aberto'), { ...fulano, ativo: false }, analista),
    ).toThrow(ValidacaoError)
  })

  it('desenvolvedor não atribui', () => {
    expect(() => atribuirResponsavel(achado('Aberto'), fulano, dev)).toThrow(AcessoNegadoError)
  })

  it.each(ENCERRAMENTO)('RN05: achado %s não aceita atribuição', (status) => {
    expect(() => atribuirResponsavel(achado(status), fulano, analista)).toThrow(ConflitoError)
  })
})

describe('edição (RN05)', () => {
  it.each(STATUS_ACHADO)('status %s', (status) => {
    const encerrado = ENCERRAMENTO.includes(status)
    if (encerrado) {
      expect(() => verificarEdicao({ status }, analista)).toThrow(ConflitoError)
      expect(() => garantirNaoEncerrado({ status })).toThrow(ConflitoError)
    } else {
      expect(() => verificarEdicao({ status }, analista)).not.toThrow()
      expect(() => garantirNaoEncerrado({ status })).not.toThrow()
    }
    expect(() => verificarEdicao({ status }, dev)).toThrow(AcessoNegadoError)
  })
})

describe('diferencasDeCampos', () => {
  it('gera um evento por campo alterado, convertendo valores para texto', () => {
    const antes = { titulo: 'A', cweId: 79, impacto: null as string | null, severidade: 'Alta' }
    const eventos = diferencasDeCampos(antes, {
      titulo: 'B',
      cweId: 89,
      impacto: 'grave',
      severidade: 'Alta',
    })
    expect(eventos).toEqual([
      {
        tipo: 'EdicaoCampo',
        campo: 'titulo',
        valorAnterior: 'A',
        valorNovo: 'B',
        justificativa: null,
      },
      {
        tipo: 'EdicaoCampo',
        campo: 'cweId',
        valorAnterior: '79',
        valorNovo: '89',
        justificativa: null,
      },
      {
        tipo: 'EdicaoCampo',
        campo: 'impacto',
        valorAnterior: null,
        valorNovo: 'grave',
        justificativa: null,
      },
    ])
  })

  it('valor apagado vira null', () => {
    const eventos = diferencasDeCampos({ cweId: 79 as number | null }, { cweId: null })
    expect(eventos[0]).toMatchObject({ valorAnterior: '79', valorNovo: null })
  })

  it('sem alterações não gera eventos', () => {
    expect(diferencasDeCampos({ titulo: 'A' }, { titulo: 'A' })).toEqual([])
  })
})

describe('estaVencido (RN09)', () => {
  const hoje = '2026-05-10'
  it.each([
    [null, 'Aberto', false],
    ['2026-05-09', 'Aberto', true],
    ['2026-05-09', 'EmCorrecao', true],
    ['2026-05-09', 'AguardandoVerificacao', true],
    ['2026-05-10', 'Aberto', false],
    ['2026-05-11', 'Aberto', false],
    ['2026-05-09', 'Corrigido', false],
    ['2026-05-09', 'FalsoPositivo', false],
    ['2026-05-09', 'RiscoAceito', false],
  ] as const)('data-limite %s, status %s → %s', (dataLimite, status, esperado) => {
    expect(estaVencido({ dataLimite, status }, hoje)).toBe(esperado)
  })
})

describe('gerarCodigoAchado (RN02)', () => {
  it.each([
    ['WEB', 7, 'WEB-0007'],
    ['REDE', 1, 'REDE-0001'],
    ['COD', 9999, 'COD-9999'],
    ['ABCDE', 123, 'ABCDE-0123'],
  ] as const)('%s + %i = %s', (prefixo, numero, codigo) => {
    expect(gerarCodigoAchado(prefixo, numero)).toBe(codigo)
    expect(codigo.length).toBeLessThanOrEqual(10)
  })

  it.each([0, -1, 10000, 1.5, Number.NaN])('recusa número %s', (numero) => {
    expect(() => gerarCodigoAchado('WEB', numero)).toThrow(RangeError)
  })

  it.each(['W', 'web', 'ABCDEF', 'A1'])('recusa prefixo %s', (prefixo) => {
    expect(() => gerarCodigoAchado(prefixo, 1)).toThrow(RangeError)
  })
})

describe('erros de domínio', () => {
  it.each([
    [new ValidacaoError([]), 400],
    [new NaoAutenticadoError(), 401],
    [new AcessoNegadoError(), 403],
    [new RecursoNaoEncontradoError(), 404],
    [new ConflitoError('x'), 409],
    [new VersaoDivergenteError(), 409],
    [new ContaBloqueadaError(), 429],
  ])('%s tem status %i, título e mensagem padrão', (erro, status) => {
    expect(erro.status).toBe(status)
    expect(erro.titulo).toBeTruthy()
    expect(erro.message).toBeTruthy()
    expect(erro.name).toBe(erro.constructor.name)
  })
})
