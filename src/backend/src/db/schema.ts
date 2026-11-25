import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  ORIGENS_ACHADO,
  PAPEIS,
  SEVERIDADES,
  STATUS_ACHADO,
  TIPOS_EVENTO,
} from '@vulncase/compartilhado'

/** Timestamps sempre em UTC (timestamptz). */
const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' })

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 120 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    papel: varchar('papel', { length: 20, enum: PAPEIS }).notNull(),
    ativo: boolean('ativo').notNull().default(true),
    tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
    bloqueadoAte: instante('bloqueado_ate'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('usuarios_email_normalizado_uq').on(sql`lower(${t.email})`),
    check('usuarios_papel_ck', sql`${t.papel} IN ('Administrador', 'Analista', 'Desenvolvedor')`),
  ],
)

export const sessoes = pgTable(
  'sessoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    criadaEm: instante('criada_em').notNull().defaultNow(),
    expiraEm: instante('expira_em').notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
  },
  (t) => [
    uniqueIndex('sessoes_token_hash_uq').on(t.tokenHash),
    index('sessoes_usuario_idx').on(t.usuarioId),
  ],
)

export const projetos = pgTable(
  'projetos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prefixo: varchar('prefixo', { length: 5 }).notNull(),
    nome: varchar('nome', { length: 120 }).notNull(),
    descricao: text('descricao'),
    responsavelTecnicoId: uuid('responsavel_tecnico_id')
      .notNull()
      .references(() => usuarios.id),
    arquivado: boolean('arquivado').notNull().default(false),
    proximoNumeroAchado: integer('proximo_numero_achado').notNull().default(1),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('projetos_prefixo_uq').on(t.prefixo),
    check('projetos_prefixo_ck', sql`${t.prefixo} ~ '^[A-Z]{2,5}$'`),
    check('projetos_descricao_ck', sql`char_length(${t.descricao}) <= 4000`),
    check('projetos_proximo_numero_ck', sql`${t.proximoNumeroAchado} >= 1`),
  ],
)

export const categoriasOwasp = pgTable(
  'categorias_owasp',
  {
    id: serial('id').primaryKey(),
    versao: varchar('versao', { length: 10 }).notNull(),
    codigo: varchar('codigo', { length: 10 }).notNull(),
    nome: varchar('nome', { length: 120 }).notNull(),
  },
  (t) => [uniqueIndex('categorias_owasp_versao_codigo_uq').on(t.versao, t.codigo)],
)

export const achados = pgTable(
  'achados',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projetoId: uuid('projeto_id')
      .notNull()
      .references(() => projetos.id),
    codigo: varchar('codigo', { length: 10 }).notNull(),
    titulo: varchar('titulo', { length: 160 }).notNull(),
    descricao: text('descricao').notNull(),
    origem: varchar('origem', { length: 30, enum: ORIGENS_ACHADO }).notNull(),
    severidade: varchar('severidade', { length: 15, enum: SEVERIDADES }).notNull(),
    status: varchar('status', { length: 25, enum: STATUS_ACHADO }).notNull().default('Aberto'),
    localizacao: varchar('localizacao', { length: 500 }).notNull(),
    impacto: text('impacto'),
    passosReproducao: text('passos_reproducao'),
    correcaoProposta: text('correcao_proposta').notNull(),
    categoriaOwaspId: integer('categoria_owasp_id').references(() => categoriasOwasp.id),
    cweId: integer('cwe_id'),
    cveId: varchar('cve_id', { length: 20 }),
    notaCvss: numeric('nota_cvss', { precision: 3, scale: 1 }),
    responsavelId: uuid('responsavel_id').references(() => usuarios.id),
    registradoPorId: uuid('registrado_por_id')
      .notNull()
      .references(() => usuarios.id),
    dataLimite: date('data_limite', { mode: 'string' }),
    /** RF24: a data-limite foi ajustada pelo analista e não é recalculada. */
    dataLimiteManual: boolean('data_limite_manual').notNull().default(false),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
    encerradoEm: instante('encerrado_em'),
    versao: integer('versao').notNull().default(1),
  },
  (t) => [
    uniqueIndex('achados_codigo_uq').on(t.codigo),
    index('achados_projeto_status_severidade_idx').on(t.projetoId, t.status, t.severidade),
    index('achados_responsavel_status_idx').on(t.responsavelId, t.status),
    index('achados_data_limite_abertos_idx')
      .on(t.dataLimite)
      .where(sql`${t.encerradoEm} IS NULL`),
    check('achados_cwe_ck', sql`${t.cweId} > 0`),
    check('achados_cve_ck', sql`${t.cveId} ~ '^CVE-[0-9]{4}-[0-9]{4,}$'`),
    check('achados_cvss_ck', sql`${t.notaCvss} BETWEEN 0 AND 10`),
    check('achados_descricao_ck', sql`char_length(${t.descricao}) <= 10000`),
    check('achados_impacto_ck', sql`char_length(${t.impacto}) <= 4000`),
    check('achados_passos_ck', sql`char_length(${t.passosReproducao}) <= 10000`),
    check('achados_correcao_ck', sql`char_length(${t.correcaoProposta}) <= 10000`),
    check(
      'achados_origem_ck',
      sql`${t.origem} IN ('AnaliseRede', 'TesteAplicacaoWeb', 'TesteAplicacaoMovel', 'RevisaoCodigo', 'AnaliseConfiguracao', 'Outra')`,
    ),
    check(
      'achados_severidade_ck',
      sql`${t.severidade} IN ('Critica', 'Alta', 'Media', 'Baixa', 'Informativa')`,
    ),
    check(
      'achados_status_ck',
      sql`${t.status} IN ('Aberto', 'EmCorrecao', 'AguardandoVerificacao', 'Corrigido', 'FalsoPositivo', 'RiscoAceito')`,
    ),
    check('achados_versao_ck', sql`${t.versao} >= 1`),
  ],
)

export const eventosHistorico = pgTable(
  'eventos_historico',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    achadoId: uuid('achado_id')
      .notNull()
      .references(() => achados.id),
    autorId: uuid('autor_id')
      .notNull()
      .references(() => usuarios.id),
    tipo: varchar('tipo', { length: 30, enum: TIPOS_EVENTO }).notNull(),
    campo: varchar('campo', { length: 50 }),
    valorAnterior: text('valor_anterior'),
    valorNovo: text('valor_novo'),
    justificativa: text('justificativa'),
    ocorridoEm: instante('ocorrido_em').notNull().defaultNow(),
    /** Ordem de inserção: desempata eventos gravados no mesmo instante. */
    sequencia: bigint('sequencia', { mode: 'number' }).generatedAlwaysAsIdentity(),
  },
  (t) => [
    index('eventos_historico_achado_ocorrido_idx').on(t.achadoId, t.ocorridoEm, t.sequencia),
    check(
      'eventos_historico_tipo_ck',
      sql`${t.tipo} IN ('Criacao', 'EdicaoCampo', 'TrocaResponsavel', 'Transicao', 'EvidenciaAdicionada', 'EvidenciaRemovida', 'Comentario')`,
    ),
  ],
)

/** Evidências anexadas ao achado (RF25, RNF14). O arquivo fica no volume, fora da raiz pública. */
export const evidencias = pgTable(
  'evidencias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    achadoId: uuid('achado_id')
      .notNull()
      .references(() => achados.id),
    nomeOriginal: varchar('nome_original', { length: 255 }).notNull(),
    nomeArmazenado: varchar('nome_armazenado', { length: 64 }).notNull(),
    tipoConteudo: varchar('tipo_conteudo', { length: 100 }).notNull(),
    tamanhoBytes: bigint('tamanho_bytes', { mode: 'number' }).notNull(),
    hashSha256: char('hash_sha256', { length: 64 }).notNull(),
    descricao: varchar('descricao', { length: 500 }),
    enviadaPorId: uuid('enviada_por_id')
      .notNull()
      .references(() => usuarios.id),
    enviadaEm: instante('enviada_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('evidencias_nome_armazenado_uq').on(t.nomeArmazenado),
    index('evidencias_achado_idx').on(t.achadoId, t.enviadaEm),
    check('evidencias_tamanho_ck', sql`${t.tamanhoBytes} BETWEEN 1 AND 5242880`),
  ],
)

/** Comentários no achado (RF21). Não são editados nem excluídos. */
export const comentarios = pgTable(
  'comentarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    achadoId: uuid('achado_id')
      .notNull()
      .references(() => achados.id),
    autorId: uuid('autor_id')
      .notNull()
      .references(() => usuarios.id),
    texto: text('texto').notNull(),
    criadoEm: instante('criado_em').notNull().defaultNow(),
  },
  (t) => [
    index('comentarios_achado_idx').on(t.achadoId, t.criadoEm),
    check('comentarios_texto_ck', sql`char_length(${t.texto}) BETWEEN 1 AND 4000`),
  ],
)
