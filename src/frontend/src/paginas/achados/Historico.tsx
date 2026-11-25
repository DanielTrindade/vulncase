import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  ROTULOS_ORIGEM,
  type Severidade,
  type StatusAchado,
  type OrigemAchado,
} from '@vulncase/compartilhado'
import { useState, type FormEvent } from 'react'
import { mensagemDeErro } from '../../api/cliente'
import { useComentar, useHistorico, type EventoHistorico } from '../../api/achados'
import { formatarData, formatarDataHora } from '../../componentes/datas'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'

const ROTULOS_CAMPO: Record<string, string> = {
  titulo: 'título',
  descricao: 'descrição',
  origem: 'origem',
  severidade: 'severidade',
  localizacao: 'localização',
  impacto: 'impacto',
  passosReproducao: 'passos de reprodução',
  correcaoProposta: 'correção proposta',
  categoriaOwasp: 'categoria OWASP',
  cweId: 'CWE',
  cveId: 'CVE',
  notaCvss: 'nota CVSS',
  dataLimite: 'data-limite',
}

/** Campos de texto longo: o histórico mostra apenas que mudaram, não o conteúdo. */
const CAMPOS_LONGOS = new Set(['descricao', 'impacto', 'passosReproducao', 'correcaoProposta'])

function rotuloValor(campo: string | null, valor: string | null): string {
  if (valor === null || valor === '') return 'vazio'
  if (campo === 'status') return ROTULOS_STATUS[valor as StatusAchado] ?? valor
  if (campo === 'severidade') return ROTULOS_SEVERIDADE[valor as Severidade] ?? valor
  if (campo === 'origem') return ROTULOS_ORIGEM[valor as OrigemAchado] ?? valor
  if (campo === 'dataLimite') return formatarData(valor)
  return valor
}

function descrever(e: EventoHistorico): string {
  switch (e.tipo) {
    case 'Criacao':
      return `registrou o achado ${e.valorNovo ?? ''}`
    case 'Transicao':
      return `alterou o status de ${rotuloValor('status', e.valorAnterior)} para ${rotuloValor('status', e.valorNovo)}`
    case 'TrocaResponsavel':
      if (!e.valorNovo) return `removeu o responsável ${e.valorAnterior ?? ''}`
      if (!e.valorAnterior) return `atribuiu a ${e.valorNovo}`
      return `trocou o responsável de ${e.valorAnterior} para ${e.valorNovo}`
    case 'EdicaoCampo': {
      const campo = e.campo ?? ''
      const nome = ROTULOS_CAMPO[campo] ?? campo
      if (CAMPOS_LONGOS.has(campo)) return `editou ${nome}`
      return `alterou ${nome} de ${rotuloValor(campo, e.valorAnterior)} para ${rotuloValor(campo, e.valorNovo)}`
    }
    case 'EvidenciaAdicionada':
      return `anexou a evidência ${e.valorNovo ?? ''}`
    case 'EvidenciaRemovida':
      return `removeu a evidência ${e.valorAnterior ?? ''}`
    case 'Comentario':
      return 'comentou'
  }
}

/** Comentário (RF21): o texto vai para o histórico e é exibido como texto. */
function FormularioComentario({ achadoId }: { achadoId: string }) {
  const comentar = useComentar(achadoId)
  const [texto, setTexto] = useState('')
  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    try {
      await comentar.mutateAsync(texto.trim())
      setTexto('')
    } catch {
      // A mensagem é exibida abaixo; o texto digitado é mantido.
    }
  }
  return (
    <form className="comentario-novo" onSubmit={(e) => void aoEnviar(e)}>
      <label className="campo">
        <span className="campo__rotulo">Comentar</span>
        <textarea
          rows={3}
          maxLength={4000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      {comentar.isError && <span className="campo__erro">{mensagemDeErro(comentar.error)}</span>}
      <div className="acoes">
        <button type="submit" className="botao" disabled={!texto.trim() || comentar.isPending}>
          {comentar.isPending ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </form>
  )
}

export function Historico({
  achadoId,
  podeComentar = false,
}: {
  achadoId: string
  podeComentar?: boolean
}) {
  const historico = useHistorico(achadoId)
  if (historico.isPending) return <Carregando />
  if (historico.isError) return <MensagemErro erro={historico.error} />
  if (historico.data.length === 0) return <Vazio>Sem eventos.</Vazio>
  return (
    <>
      <ol className="linha-tempo">
        {historico.data.map((e) => (
          <li key={e.id} className={`linha-tempo__item linha-tempo__item--${e.tipo}`}>
            <div className="linha-tempo__cabecalho">
              <strong>{e.autor.nome}</strong> {descrever(e)}
            </div>
            {e.tipo === 'Comentario' && e.valorNovo && (
              <p className="linha-tempo__comentario texto-pre">{e.valorNovo}</p>
            )}
            {e.justificativa && (
              <blockquote className="linha-tempo__justificativa texto-pre">
                {e.justificativa}
              </blockquote>
            )}
            <time className="linha-tempo__data" dateTime={String(e.ocorridoEm)}>
              {formatarDataHora(e.ocorridoEm)}
            </time>
          </li>
        ))}
      </ol>
      {podeComentar && <FormularioComentario achadoId={achadoId} />}
    </>
  )
}
