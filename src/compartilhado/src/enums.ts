/**
 * Enumerações do domínio (docs/03-modelagem.md, Tabela 1).
 * Declaradas como uniões de literais e gravadas no banco como texto.
 */

export const PAPEIS = ['Administrador', 'Analista', 'Desenvolvedor'] as const
export type Papel = (typeof PAPEIS)[number]

export const SEVERIDADES = ['Critica', 'Alta', 'Media', 'Baixa', 'Informativa'] as const
export type Severidade = (typeof SEVERIDADES)[number]

export const STATUS_ACHADO = [
  'Aberto',
  'EmCorrecao',
  'AguardandoVerificacao',
  'Corrigido',
  'FalsoPositivo',
  'RiscoAceito',
] as const
export type StatusAchado = (typeof STATUS_ACHADO)[number]

/** Estados de encerramento (RN05). */
export const STATUS_ENCERRAMENTO = [
  'Corrigido',
  'FalsoPositivo',
  'RiscoAceito',
] as const satisfies readonly StatusAchado[]
export type StatusEncerramento = (typeof STATUS_ENCERRAMENTO)[number]

/** Estados considerados "abertos" (não encerrados). */
export const STATUS_NAO_ENCERRADOS = [
  'Aberto',
  'EmCorrecao',
  'AguardandoVerificacao',
] as const satisfies readonly StatusAchado[]

export function estaEncerrado(status: StatusAchado): boolean {
  return (STATUS_ENCERRAMENTO as readonly StatusAchado[]).includes(status)
}

export const ORIGENS_ACHADO = [
  'AnaliseRede',
  'TesteAplicacaoWeb',
  'TesteAplicacaoMovel',
  'RevisaoCodigo',
  'AnaliseConfiguracao',
  'Outra',
] as const
export type OrigemAchado = (typeof ORIGENS_ACHADO)[number]

export const TIPOS_EVENTO = [
  'Criacao',
  'EdicaoCampo',
  'TrocaResponsavel',
  'Transicao',
  'EvidenciaAdicionada',
  'EvidenciaRemovida',
  'Comentario',
] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export const TIPOS_ATIVO = [
  'AplicacaoWeb',
  'Api',
  'AplicativoMovel',
  'Servidor',
  'ServicoRede',
  'RepositorioCodigo',
  'Outro',
] as const
export type TipoAtivo = (typeof TIPOS_ATIVO)[number]

export const AMBIENTES = ['Desenvolvimento', 'Homologacao', 'Producao', 'Laboratorio'] as const
export type Ambiente = (typeof AMBIENTES)[number]

/** Rótulos em português para exibição. */
export const ROTULOS_SEVERIDADE: Record<Severidade, string> = {
  Critica: 'Crítica',
  Alta: 'Alta',
  Media: 'Média',
  Baixa: 'Baixa',
  Informativa: 'Informativa',
}

export const ROTULOS_STATUS: Record<StatusAchado, string> = {
  Aberto: 'Aberto',
  EmCorrecao: 'Em correção',
  AguardandoVerificacao: 'Aguardando verificação',
  Corrigido: 'Corrigido',
  FalsoPositivo: 'Falso positivo',
  RiscoAceito: 'Risco aceito',
}

export const ROTULOS_ORIGEM: Record<OrigemAchado, string> = {
  AnaliseRede: 'Análise de rede',
  TesteAplicacaoWeb: 'Teste de aplicação web',
  TesteAplicacaoMovel: 'Teste de aplicação móvel',
  RevisaoCodigo: 'Revisão de código',
  AnaliseConfiguracao: 'Análise de configuração',
  Outra: 'Outra',
}

export const ROTULOS_PAPEL: Record<Papel, string> = {
  Administrador: 'Administrador',
  Analista: 'Analista',
  Desenvolvedor: 'Desenvolvedor',
}

export const ROTULOS_TIPO_ATIVO: Record<TipoAtivo, string> = {
  AplicacaoWeb: 'Aplicação web',
  Api: 'API',
  AplicativoMovel: 'Aplicativo móvel',
  Servidor: 'Servidor',
  ServicoRede: 'Serviço de rede',
  RepositorioCodigo: 'Repositório de código',
  Outro: 'Outro',
}

export const ROTULOS_AMBIENTE: Record<Ambiente, string> = {
  Desenvolvimento: 'Desenvolvimento',
  Homologacao: 'Homologação',
  Producao: 'Produção',
  Laboratorio: 'Laboratório',
}
