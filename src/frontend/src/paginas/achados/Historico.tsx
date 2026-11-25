import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  ROTULOS_ORIGEM,
  type Severidade,
  type StatusAchado,
  type OrigemAchado,
} from '@vulncase/compartilhado'
import { useState, type FormEvent } from 'react'
import {
  ArrowRightLeftIcon,
  CirclePlusIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PencilLineIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react'
import type { TipoEvento } from '@vulncase/compartilhado'
import { mensagemDeErro } from '@/api/cliente'
import { useComentar, useHistorico, type EventoHistorico } from '@/api/achados'
import { formatarData, formatarDataHora } from '@/componentes/datas'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { Button } from '@/componentes/ui/button'
import { FieldError } from '@/componentes/ui/field'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'
import { cn } from '@/lib/utils'

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

const ICONES: Record<TipoEvento, LucideIcon> = {
  Criacao: CirclePlusIcon,
  Transicao: ArrowRightLeftIcon,
  TrocaResponsavel: UserRoundIcon,
  EdicaoCampo: PencilLineIcon,
  EvidenciaAdicionada: PaperclipIcon,
  EvidenciaRemovida: PaperclipIcon,
  Comentario: MessageSquareIcon,
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
    <form
      className="comentario-novo mt-2 grid gap-2 border-t pt-4"
      onSubmit={(e) => void aoEnviar(e)}
    >
      <label htmlFor="comentario" className="sr-only">
        Comentário
      </label>
      <Textarea
        id="comentario"
        rows={3}
        maxLength={4000}
        placeholder="Escreva um comentário para a equipe"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {comentar.isError && <FieldError>{mensagemDeErro(comentar.error)}</FieldError>}
      <div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!texto.trim() || comentar.isPending}
        >
          {comentar.isPending && <Spinner />}
          Comentar
        </Button>
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
  // Eventos que chegam depois da primeira carga entram com animação (resposta a uma ação).
  const [iniciais, setIniciais] = useState<Set<string> | null>(null)
  if (historico.data && iniciais === null) setIniciais(new Set(historico.data.map((e) => e.id)))
  if (historico.isPending) return <Carregando />
  if (historico.isError) return <MensagemErro erro={historico.error} />

  return (
    <>
      <ol className="relative grid gap-5">
        {historico.data.map((e, i) => {
          const Icone = ICONES[e.tipo]
          const novo = iniciais !== null && !iniciais.has(e.id)
          return (
            <li
              key={e.id}
              data-evento={e.tipo}
              className={cn(
                'linha-tempo__item relative grid grid-cols-[28px_1fr] gap-3',
                novo && 'evento-entra',
              )}
            >
              {i < historico.data.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-8 bottom-[-16px] left-[13.5px] w-px bg-border"
                />
              )}
              <span
                className={cn(
                  'relative flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground',
                  e.tipo === 'Transicao' && 'border-primary/40 text-primary',
                  e.tipo === 'Comentario' && 'border-primary/40 bg-primary/5 text-primary',
                )}
              >
                <Icone className="size-3.5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="linha-tempo__cabecalho text-sm">
                  <span className="font-semibold">{e.autor.nome}</span> {descrever(e)}
                </p>
                {e.tipo === 'Comentario' && e.valorNovo && (
                  <p className="linha-tempo__comentario texto-pre mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                    {e.valorNovo}
                  </p>
                )}
                {e.justificativa && (
                  <blockquote className="linha-tempo__justificativa texto-pre mt-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                    {e.justificativa}
                  </blockquote>
                )}
                <time
                  className="mt-1 block text-xs text-muted-foreground tabular-nums"
                  dateTime={String(e.ocorridoEm)}
                >
                  {formatarDataHora(e.ocorridoEm)}
                </time>
              </div>
            </li>
          )
        })}
      </ol>
      {podeComentar && <FormularioComentario achadoId={achadoId} />}
    </>
  )
}
