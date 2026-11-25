import { describe, expect, it } from 'vitest'
import { PAPEIS, STATUS_ACHADO, type Papel, type StatusAchado } from '@vulncase/compartilhado'
import {
  acoesPermitidas,
  transicionar,
  transicoesPermitidas,
  type Ator,
  type EstadoAchado,
} from '../../src/dominio/achado.js'
import {
  AcessoNegadoError,
  TransicaoInvalidaError,
  ValidacaoError,
} from '../../src/dominio/erros.js'
import { REGRAS_TRANSICAO } from '../../src/dominio/regras-transicao.js'

/**
 * Tabela 7 do documento 03, transcrita de forma independente da implementação.
 * resp = o responsável pelo achado também pode executar (RN04).
 */
type Linha = {
  papeis: Papel[]
  resp?: boolean
  justificativa?: boolean
  exigeResponsavel?: boolean
}
const AA: Papel[] = ['Analista', 'Administrador']
const TABELA_7: Record<string, Linha> = {
  'Aberto>EmCorrecao': { papeis: AA, exigeResponsavel: true },
  'Aberto>FalsoPositivo': { papeis: AA, justificativa: true },
  'Aberto>RiscoAceito': { papeis: ['Administrador'], justificativa: true },
  'EmCorrecao>AguardandoVerificacao': { papeis: AA, resp: true },
  'EmCorrecao>Aberto': { papeis: AA },
  'EmCorrecao>RiscoAceito': { papeis: ['Administrador'], justificativa: true },
  'AguardandoVerificacao>Corrigido': { papeis: AA },
  'AguardandoVerificacao>EmCorrecao': { papeis: AA, justificativa: true, exigeResponsavel: true },
  'Corrigido>Aberto': { papeis: AA, justificativa: true },
  'FalsoPositivo>Aberto': { papeis: AA, justificativa: true },
  'RiscoAceito>Aberto': { papeis: AA, justificativa: true },
}

const AGORA = new Date('2026-05-10T12:00:00Z')
const ANTES = new Date('2026-05-01T12:00:00Z')
const ENCERRAMENTO: StatusAchado[] = ['Corrigido', 'FalsoPositivo', 'RiscoAceito']

function achado(status: StatusAchado, responsavelId: string | null = 'u-resp'): EstadoAchado {
  return {
    status,
    responsavel: responsavelId ? { id: responsavelId, nome: 'Responsável' } : null,
    encerradoEm: ENCERRAMENTO.includes(status) ? ANTES : null,
  }
}

const casos: [StatusAchado, StatusAchado, Papel, boolean][] = []
for (const origem of STATUS_ACHADO)
  for (const destino of STATUS_ACHADO)
    for (const papel of PAPEIS)
      for (const ehResp of [false, true]) casos.push([origem, destino, papel, ehResp])

describe('transicionar: todas as combinações de origem, destino, papel e propriedade', () => {
  it('a estrutura de regras corresponde exatamente à Tabela 7', () => {
    const chaves = REGRAS_TRANSICAO.map((r) => `${r.origem}>${r.destino}`).sort()
    expect(chaves).toEqual(Object.keys(TABELA_7).sort())
  })

  it.each(casos)('%s → %s por %s (responsável: %s)', (origem, destino, papel, ehResp) => {
    const ator: Ator = { id: ehResp ? 'u-resp' : 'u-outro', papel }
    const linha = TABELA_7[`${origem}>${destino}`]
    const executar = () =>
      transicionar(achado(origem), destino, ator, 'Justificativa de teste', AGORA)

    if (!linha) {
      expect(executar).toThrow(TransicaoInvalidaError)
      return
    }
    const permitido = linha.papeis.includes(papel) || (linha.resp === true && ehResp)
    if (!permitido) {
      expect(executar).toThrow(AcessoNegadoError)
      return
    }
    const { achado: novo, eventos } = executar()
    expect(novo.status).toBe(destino)
    expect(eventos[0]).toEqual({
      tipo: 'Transicao',
      campo: 'status',
      valorAnterior: origem,
      valorNovo: destino,
      justificativa: 'Justificativa de teste',
    })
    // RN06
    if (ENCERRAMENTO.includes(destino)) expect(novo.encerradoEm).toEqual(AGORA)
    else expect(novo.encerradoEm).toBeNull()
  })
})

describe('regras específicas', () => {
  const analista: Ator = { id: 'u-ana', papel: 'Analista' }
  const admin: Ator = { id: 'u-adm', papel: 'Administrador' }
  const dev: Ator = { id: 'u-resp', papel: 'Desenvolvedor' }

  it.each(Object.entries(TABELA_7).filter(([, l]) => l.justificativa))(
    'RF17: %s exige justificativa',
    (chave) => {
      const [origem, destino] = chave.split('>') as [StatusAchado, StatusAchado]
      for (const vazia of [null, undefined, '', '   ']) {
        expect(() => transicionar(achado(origem), destino, admin, vazia, AGORA)).toThrow(
          ValidacaoError,
        )
      }
    },
  )

  it('transições sem exigência aceitam justificativa vazia e gravam null', () => {
    const r = transicionar(achado('AguardandoVerificacao'), 'Corrigido', analista, '  ', AGORA)
    expect(r.eventos[0]!.justificativa).toBeNull()
  })

  it('a justificativa é gravada sem espaços nas pontas', () => {
    const r = transicionar(
      achado('Aberto'),
      'FalsoPositivo',
      analista,
      '  era a página de login  ',
      AGORA,
    )
    expect(r.eventos[0]!.justificativa).toBe('era a página de login')
  })

  it('RN03: não inicia correção sem responsável', () => {
    expect(() => transicionar(achado('Aberto', null), 'EmCorrecao', analista, null, AGORA)).toThrow(
      TransicaoInvalidaError,
    )
  })

  it('RN03: não reprova verificação sem responsável', () => {
    expect(() =>
      transicionar(achado('AguardandoVerificacao', null), 'EmCorrecao', analista, 'refazer', AGORA),
    ).toThrow(TransicaoInvalidaError)
  })

  it('RN04/A17: desenvolvedor não conclui correção de achado de outra pessoa', () => {
    expect(() =>
      transicionar(achado('EmCorrecao', 'u-outra'), 'AguardandoVerificacao', dev, null, AGORA),
    ).toThrow(AcessoNegadoError)
  })

  it('RN04: desenvolvedor responsável conclui correção', () => {
    const r = transicionar(
      achado('EmCorrecao', 'u-resp'),
      'AguardandoVerificacao',
      dev,
      null,
      AGORA,
    )
    expect(r.achado.status).toBe('AguardandoVerificacao')
  })

  it('a mensagem de acesso negado difere entre regra com e sem responsável', () => {
    let msgResp = ''
    let msgPapel = ''
    try {
      transicionar(achado('EmCorrecao', 'x'), 'AguardandoVerificacao', dev, null, AGORA)
    } catch (e) {
      msgResp = (e as Error).message
    }
    try {
      transicionar(achado('Aberto'), 'RiscoAceito', analista, 'x', AGORA)
    } catch (e) {
      msgPapel = (e as Error).message
    }
    expect(msgResp).toContain('responsável')
    expect(msgPapel).toContain('papel')
  })

  it('EmCorrecao → Aberto remove o responsável e registra a troca', () => {
    const r = transicionar(achado('EmCorrecao'), 'Aberto', analista, null, AGORA)
    expect(r.achado.responsavel).toBeNull()
    expect(r.eventos.map((e) => e.tipo)).toEqual(['Transicao', 'TrocaResponsavel'])
    expect(r.eventos[1]).toMatchObject({ valorAnterior: 'Responsável', valorNovo: null })
  })

  it('EmCorrecao → Aberto sem responsável gera só o evento de transição', () => {
    const r = transicionar(achado('EmCorrecao', null), 'Aberto', analista, null, AGORA)
    expect(r.eventos).toHaveLength(1)
  })

  it('RN06: reabrir limpa encerrado_em; encerrar define', () => {
    const reaberto = transicionar(achado('Corrigido'), 'Aberto', analista, 'voltou', AGORA)
    expect(reaberto.achado.encerradoEm).toBeNull()
    const encerrado = transicionar(
      achado('AguardandoVerificacao'),
      'Corrigido',
      analista,
      null,
      AGORA,
    )
    expect(encerrado.achado.encerradoEm).toBe(AGORA)
  })

  it('não altera o objeto original e preserva campos extras', () => {
    const original = { ...achado('Aberto'), codigo: 'WEB-0001' }
    const r = transicionar(original, 'EmCorrecao', analista, null, AGORA)
    expect(original.status).toBe('Aberto')
    expect(r.achado.codigo).toBe('WEB-0001')
  })
})

describe('transicoesPermitidas e acoesPermitidas', () => {
  it('coerentes com transicionar para todas as combinações', () => {
    for (const status of STATUS_ACHADO)
      for (const papel of PAPEIS)
        for (const resp of [null, 'u-ator', 'u-outro']) {
          const a = achado(status, resp)
          const ator: Ator = { id: 'u-ator', papel }
          const permitidas = transicoesPermitidas(a, ator).map((t) => t.destino)
          for (const destino of STATUS_ACHADO) {
            let ok = true
            try {
              transicionar(a, destino, ator, 'j', AGORA)
            } catch {
              ok = false
            }
            expect(permitidas.includes(destino), `${status}>${destino} ${papel} ${resp}`).toBe(ok)
          }
        }
  })

  it('informa rótulo e exigência de justificativa', () => {
    const t = transicoesPermitidas(achado('Aberto'), { id: 'x', papel: 'Administrador' })
    expect(t).toContainEqual({
      destino: 'RiscoAceito',
      rotulo: 'Aceitar risco',
      exigeJustificativa: true,
    })
    expect(t).toContainEqual({
      destino: 'EmCorrecao',
      rotulo: 'Iniciar correção',
      exigeJustificativa: false,
    })
  })

  it('editar e atribuir só para gestores em achados não encerrados', () => {
    expect(acoesPermitidas(achado('Aberto'), { id: 'x', papel: 'Analista' })).toMatchObject({
      editar: true,
      atribuirResponsavel: true,
    })
    expect(acoesPermitidas(achado('Aberto'), { id: 'x', papel: 'Desenvolvedor' })).toMatchObject({
      editar: false,
      atribuirResponsavel: false,
    })
    expect(acoesPermitidas(achado('Corrigido'), { id: 'x', papel: 'Administrador' })).toMatchObject(
      {
        editar: false,
        atribuirResponsavel: false,
        transicoes: [{ destino: 'Aberto', rotulo: 'Reabrir', exigeJustificativa: true }],
      },
    )
  })
})
