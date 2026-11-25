import { and, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type {
  EntradaAtribuirResponsavel,
  EntradaCriarAchado,
  EntradaEditarAchado,
  EntradaTransicao,
} from '@vulncase/compartilhado'
import type { UsuarioSessao } from '../ambiente.js'
import type { BancoDados } from '../db/cliente.js'
import { achados, categoriasOwasp, eventosHistorico, projetos, usuarios } from '../db/schema.js'
import {
  acoesPermitidas,
  atribuirResponsavel,
  diferencasDeCampos,
  estaVencido,
  transicionar,
  verificarEdicao,
  type EventoNovo,
} from '../dominio/achado.js'
import {
  ConflitoError,
  RecursoNaoEncontradoError,
  ValidacaoError,
  VersaoDivergenteError,
} from '../dominio/erros.js'
import { gerarCodigoAchado, NUMERO_MAXIMO_ACHADO } from '../dominio/projeto.js'
import type { Log } from '../infra/log.js'

export type Transacao = Parameters<Parameters<BancoDados['transaction']>[0]>[0]
type Executor = BancoDados | Transacao

/** Data de hoje (AAAA-MM-DD) em UTC, para RN09. */
export function hojeUtc(agora = new Date()): string {
  return agora.toISOString().slice(0, 10)
}

const responsavel = alias(usuarios, 'responsavel')
const registradoPor = alias(usuarios, 'registrado_por')

/** Carrega o achado com projeto, categoria e pessoas, sem as ações. */
export async function carregarAchado(db: Executor, id: string) {
  const [linha] = await db
    .select({
      achado: achados,
      projeto: {
        id: projetos.id,
        prefixo: projetos.prefixo,
        nome: projetos.nome,
        arquivado: projetos.arquivado,
      },
      categoria: {
        id: categoriasOwasp.id,
        versao: categoriasOwasp.versao,
        codigo: categoriasOwasp.codigo,
        nome: categoriasOwasp.nome,
      },
      responsavel: { id: responsavel.id, nome: responsavel.nome },
      registradoPor: { id: registradoPor.id, nome: registradoPor.nome },
    })
    .from(achados)
    .innerJoin(projetos, eq(projetos.id, achados.projetoId))
    .innerJoin(registradoPor, eq(registradoPor.id, achados.registradoPorId))
    .leftJoin(responsavel, eq(responsavel.id, achados.responsavelId))
    .leftJoin(categoriasOwasp, eq(categoriasOwasp.id, achados.categoriaOwaspId))
    .where(eq(achados.id, id))
  if (!linha) throw new RecursoNaoEncontradoError('Achado não encontrado.')
  return linha
}

export type AchadoCarregado = Awaited<ReturnType<typeof carregarAchado>>

/** Converte para o formato da API, com as ações permitidas ao usuário (RF19). */
export function formatarAchado(c: AchadoCarregado, usuario: UsuarioSessao, hoje = hojeUtc()) {
  const a = c.achado
  const estado = { status: a.status, responsavel: c.responsavel, encerradoEm: a.encerradoEm }
  const acoes = c.projeto.arquivado
    ? { editar: false, atribuirResponsavel: false, anexarEvidencia: false, transicoes: [] }
    : acoesPermitidas(estado, usuario)
  return {
    id: a.id,
    codigo: a.codigo,
    titulo: a.titulo,
    descricao: a.descricao,
    origem: a.origem,
    severidade: a.severidade,
    status: a.status,
    localizacao: a.localizacao,
    impacto: a.impacto,
    passosReproducao: a.passosReproducao,
    correcaoProposta: a.correcaoProposta,
    categoriaOwasp: c.categoria,
    cweId: a.cweId,
    cveId: a.cveId,
    notaCvss: a.notaCvss === null ? null : Number(a.notaCvss),
    dataLimite: a.dataLimite,
    vencido: estaVencido(a, hoje),
    projeto: c.projeto,
    responsavel: c.responsavel,
    registradoPor: c.registradoPor,
    criadoEm: a.criadoEm,
    atualizadoEm: a.atualizadoEm,
    encerradoEm: a.encerradoEm,
    versao: a.versao,
    acoes,
  }
}

export type AchadoDto = ReturnType<typeof formatarAchado>

export async function detalharAchado(db: BancoDados, id: string, usuario: UsuarioSessao) {
  return formatarAchado(await carregarAchado(db, id), usuario)
}

export async function inserirEventos(
  tx: Executor,
  achadoId: string,
  autorId: string,
  eventos: EventoNovo[],
  agora: Date,
): Promise<void> {
  if (eventos.length === 0) return
  await tx
    .insert(eventosHistorico)
    .values(eventos.map((e) => ({ ...e, achadoId, autorId, ocorridoEm: agora })))
}

/** Responsável ativo (RN11) ou erro de validação no campo. */
export async function buscarResponsavelAtivo(db: Executor, id: string) {
  const [u] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, id))
  if (!u?.ativo) {
    throw new ValidacaoError([{ campo: 'responsavelId', mensagem: 'Escolha um usuário ativo.' }])
  }
  return u
}

async function descreverCategoria(db: Executor, id: number | null): Promise<string | null> {
  if (id === null) return null
  const [c] = await db
    .select({
      versao: categoriasOwasp.versao,
      codigo: categoriasOwasp.codigo,
      nome: categoriasOwasp.nome,
    })
    .from(categoriasOwasp)
    .where(eq(categoriasOwasp.id, id))
  if (!c) {
    throw new ValidacaoError([{ campo: 'categoriaOwaspId', mensagem: 'Categoria inexistente.' }])
  }
  return `${c.codigo}:${c.versao} ${c.nome}`
}

function valoresParaBanco(e: Omit<EntradaCriarAchado, 'responsavelId'>) {
  return {
    titulo: e.titulo,
    descricao: e.descricao,
    origem: e.origem,
    severidade: e.severidade,
    localizacao: e.localizacao,
    impacto: e.impacto,
    passosReproducao: e.passosReproducao,
    correcaoProposta: e.correcaoProposta,
    categoriaOwaspId: e.categoriaOwaspId,
    cweId: e.cweId,
    cveId: e.cveId,
    notaCvss: e.notaCvss === null ? null : e.notaCvss.toFixed(1),
  }
}

/**
 * Registra o achado (UC04, Figura 6). O projeto é bloqueado com SELECT ... FOR UPDATE
 * para que registros simultâneos não recebam o mesmo número (RN02).
 */
export async function registrarAchado(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  projetoId: string,
  entrada: EntradaCriarAchado,
): Promise<AchadoDto> {
  const agora = new Date()
  const id = await db.transaction(async (tx) => {
    const [projeto] = await tx
      .select()
      .from(projetos)
      .where(eq(projetos.id, projetoId))
      .for('update')
    if (!projeto) throw new RecursoNaoEncontradoError('Projeto não encontrado.')
    if (projeto.arquivado) throw new ConflitoError('Projeto arquivado não aceita novos achados.')
    if (projeto.proximoNumeroAchado > NUMERO_MAXIMO_ACHADO) {
      throw new ConflitoError('O projeto atingiu o número máximo de achados.')
    }

    await descreverCategoria(tx, entrada.categoriaOwaspId)
    const resp = entrada.responsavelId
      ? await buscarResponsavelAtivo(tx, entrada.responsavelId)
      : null
    const codigo = gerarCodigoAchado(projeto.prefixo, projeto.proximoNumeroAchado)

    const [criado] = await tx
      .insert(achados)
      .values({
        ...valoresParaBanco(entrada),
        projetoId,
        codigo,
        status: 'Aberto',
        responsavelId: resp?.id ?? null,
        registradoPorId: autor.id,
        criadoEm: agora,
        atualizadoEm: agora,
      })
      .returning({ id: achados.id })

    await tx
      .update(projetos)
      .set({ proximoNumeroAchado: sql`${projetos.proximoNumeroAchado} + 1` })
      .where(eq(projetos.id, projetoId))

    const eventos: EventoNovo[] = [
      { tipo: 'Criacao', campo: null, valorAnterior: null, valorNovo: codigo, justificativa: null },
    ]
    if (resp) {
      eventos.push({
        tipo: 'TrocaResponsavel',
        campo: 'responsavel',
        valorAnterior: null,
        valorNovo: resp.nome,
        justificativa: null,
      })
    }
    await inserirEventos(tx, criado!.id, autor.id, eventos, agora)
    log.info({ evento: 'achado.registrado', autorId: autor.id, achadoId: criado!.id, codigo })
    return criado!.id
  })
  return detalharAchado(db, id, autor)
}

/**
 * Edita os campos descritivos (RF12, RN05) com concorrência otimista (DT08) e um
 * evento EdicaoCampo por campo alterado (RF20).
 */
export async function editarAchado(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
  entrada: EntradaEditarAchado,
): Promise<AchadoDto> {
  const agora = new Date()
  await db.transaction(async (tx) => {
    const atual = await carregarAchado(tx, id)
    if (atual.projeto.arquivado) throw new ConflitoError('O projeto do achado está arquivado.')
    verificarEdicao(atual.achado, autor)
    if (atual.achado.versao !== entrada.versao) throw new VersaoDivergenteError()

    const { versao: _versao, ...campos } = entrada
    const novos = valoresParaBanco(campos)
    const a = atual.achado
    const antes = {
      titulo: a.titulo,
      descricao: a.descricao,
      origem: a.origem,
      severidade: a.severidade,
      localizacao: a.localizacao,
      impacto: a.impacto,
      passosReproducao: a.passosReproducao,
      correcaoProposta: a.correcaoProposta,
      categoriaOwasp: await descreverCategoria(tx, a.categoriaOwaspId),
      cweId: a.cweId,
      cveId: a.cveId,
      notaCvss: a.notaCvss,
    }
    const { categoriaOwaspId, ...resto } = novos
    const depois = { ...resto, categoriaOwasp: await descreverCategoria(tx, categoriaOwaspId) }
    const eventos = diferencasDeCampos(antes, depois)
    if (eventos.length === 0) return

    const atualizados = await tx
      .update(achados)
      .set({ ...novos, atualizadoEm: agora, versao: sql`${achados.versao} + 1` })
      .where(and(eq(achados.id, id), eq(achados.versao, entrada.versao)))
      .returning({ id: achados.id })
    if (atualizados.length === 0) throw new VersaoDivergenteError()

    await inserirEventos(tx, id, autor.id, eventos, agora)
    log.info({
      evento: 'achado.editado',
      autorId: autor.id,
      achadoId: id,
      campos: eventos.map((e) => e.campo),
    })
  })
  return detalharAchado(db, id, autor)
}

/** Grava o novo estado com concorrência otimista; 0 linhas afetadas é conflito (Figura 7). */
async function gravarEstado(
  tx: Transacao,
  id: string,
  versaoLida: number,
  estado: {
    status: AchadoCarregado['achado']['status']
    responsavelId: string | null
    encerradoEm: Date | null
  },
  agora: Date,
): Promise<void> {
  const atualizados = await tx
    .update(achados)
    .set({ ...estado, atualizadoEm: agora, versao: sql`${achados.versao} + 1` })
    .where(and(eq(achados.id, id), eq(achados.versao, versaoLida)))
    .returning({ id: achados.id })
  if (atualizados.length === 0) throw new VersaoDivergenteError()
}

/** Atribui, troca ou remove o responsável (RF15, RN03, UC06). */
export async function alterarResponsavel(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
  entrada: EntradaAtribuirResponsavel,
): Promise<AchadoDto> {
  const agora = new Date()
  await db.transaction(async (tx) => {
    const atual = await carregarAchado(tx, id)
    if (atual.projeto.arquivado) throw new ConflitoError('O projeto do achado está arquivado.')
    if (atual.achado.versao !== entrada.versao) throw new VersaoDivergenteError()
    const novo = entrada.responsavelId
      ? await buscarUsuarioParaAtribuicao(tx, entrada.responsavelId)
      : null
    const { achado: depois, eventos } = atribuirResponsavel(
      {
        status: atual.achado.status,
        responsavel: atual.responsavel,
        encerradoEm: atual.achado.encerradoEm,
      },
      novo,
      autor,
    )
    if (eventos.length === 0) return
    await gravarEstado(
      tx,
      id,
      entrada.versao,
      {
        status: depois.status,
        responsavelId: depois.responsavel?.id ?? null,
        encerradoEm: depois.encerradoEm,
      },
      agora,
    )
    await inserirEventos(tx, id, autor.id, eventos, agora)
    log.info({
      evento: 'achado.responsavel_alterado',
      autorId: autor.id,
      achadoId: id,
      responsavelId: depois.responsavel?.id ?? null,
    })
  })
  return detalharAchado(db, id, autor)
}

async function buscarUsuarioParaAtribuicao(db: Executor, id: string) {
  const [u] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo })
    .from(usuarios)
    .where(eq(usuarios.id, id))
  if (!u) {
    throw new ValidacaoError([{ campo: 'responsavelId', mensagem: 'Usuário inexistente.' }])
  }
  return u
}

/**
 * Altera o status pela máquina de estados (RF16, RF17, Figura 7). As regras de papel,
 * propriedade e justificativa ficam em dominio/achado.ts; aqui só se carrega, chama
 * o domínio e grava estado e evento na mesma transação.
 */
export async function executarTransicao(
  db: BancoDados,
  log: Log,
  autor: UsuarioSessao,
  id: string,
  entrada: EntradaTransicao,
): Promise<AchadoDto> {
  const agora = new Date()
  await db.transaction(async (tx) => {
    const atual = await carregarAchado(tx, id)
    if (atual.projeto.arquivado) throw new ConflitoError('O projeto do achado está arquivado.')
    // A versão é conferida antes das regras: o cliente decidiu sobre um estado antigo.
    if (atual.achado.versao !== entrada.versao) throw new VersaoDivergenteError()
    const { achado: depois, eventos } = transicionar(
      {
        status: atual.achado.status,
        responsavel: atual.responsavel,
        encerradoEm: atual.achado.encerradoEm,
      },
      entrada.destino,
      autor,
      entrada.justificativa,
      agora,
    )
    await gravarEstado(
      tx,
      id,
      entrada.versao,
      {
        status: depois.status,
        responsavelId: depois.responsavel?.id ?? null,
        encerradoEm: depois.encerradoEm,
      },
      agora,
    )
    await inserirEventos(tx, id, autor.id, eventos, agora)
    log.info({
      evento: 'achado.transicao',
      autorId: autor.id,
      achadoId: id,
      de: atual.achado.status,
      para: entrada.destino,
    })
  })
  return detalharAchado(db, id, autor)
}
