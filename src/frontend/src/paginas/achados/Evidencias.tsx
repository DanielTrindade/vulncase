import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CircleAlertIcon, FileIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { ErroApi, mensagemDeErro } from '@/api/cliente'
import {
  useEnviarEvidencia,
  useEvidencias,
  useRemoverEvidencia,
  type Achado,
  type Evidencia,
} from '@/api/achados'
import { useSessao, useUsuario } from '@/auth/sessao'
import { formatarDataHora } from '@/componentes/datas'
import { DialogoConfirmacao } from '@/componentes/dialogo'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { Spinner } from '@/componentes/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/componentes/ui/tooltip'
import { cn } from '@/lib/utils'

const TAMANHO_MAXIMO = 5 * 1024 * 1024
const EXTENSOES = '.png,.jpg,.jpeg,.pdf,.txt,.pcap,.pcapng'

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function mensagemEnvio(err: unknown): string {
  if (err instanceof ErroApi) {
    if (err.status === 413) return 'O arquivo passa do limite de 5 MB.'
    if (err.status === 415) return `Tipo de arquivo não permitido. ${err.message}`
  }
  return mensagemDeErro(err)
}

/** Pré-visualização somente de imagens, via <img> (nunca HTML, SVG ou PDF embutido). */
function ehImagem(e: Evidencia): boolean {
  return e.tipoConteudo === 'image/png' || e.tipoConteudo === 'image/jpeg'
}

function FormularioEnvio({ achadoId }: { achadoId: string }) {
  const enviar = useEnviarEvidencia(achadoId)
  const entrada = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)

  function escolher(f: File | null) {
    setErro(null)
    setArquivo(f)
  }

  function aoSoltar(e: DragEvent) {
    e.preventDefault()
    setArrastando(false)
    escolher(e.dataTransfer.files[0] ?? null)
  }

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!arquivo) return setErro('Escolha um arquivo.')
    if (arquivo.size > TAMANHO_MAXIMO) return setErro('O arquivo passa do limite de 5 MB.')
    try {
      await enviar.mutateAsync({ arquivo, descricao })
      toast.success(`Evidência ${arquivo.name} anexada`)
      setArquivo(null)
      setDescricao('')
      if (entrada.current) entrada.current.value = ''
    } catch (err) {
      setErro(mensagemEnvio(err))
    }
  }

  return (
    <form
      className="envio-evidencia mt-4 grid gap-3 border-t pt-4"
      onSubmit={(e) => void aoEnviar(e)}
    >
      {erro && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm transition-colors duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
          arrastando ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
        )}
      >
        <UploadIcon className="size-5 text-muted-foreground" />
        {arquivo ? (
          <span className="font-medium">
            {arquivo.name}{' '}
            <span className="font-normal text-muted-foreground">
              ({formatarTamanho(arquivo.size)})
            </span>
          </span>
        ) : (
          <span>
            <span className="font-medium text-primary">Escolha um arquivo</span> ou arraste para cá
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          PNG, JPG, PDF, TXT, PCAP ou PCAPNG, até 5 MB
        </span>
        <input
          ref={entrada}
          type="file"
          accept={EXTENSOES}
          aria-label="Arquivo de evidência"
          className="sr-only"
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[220px] flex-1 gap-1.5">
          <Label htmlFor="descricao-evidencia">Descrição (opcional)</Label>
          <Input
            id="descricao-evidencia"
            maxLength={500}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!arquivo || enviar.isPending}>
          {enviar.isPending && <Spinner />}
          Anexar evidência
        </Button>
      </div>
    </form>
  )
}

export function Evidencias({ achado }: { achado: Achado }) {
  const eu = useUsuario()
  const { temPapel } = useSessao()
  const evidencias = useEvidencias(achado.id)
  const remover = useRemoverEvidencia(achado.id)
  const [alvo, setAlvo] = useState<Evidencia | null>(null)
  const aberto = achado.encerradoEm === null && !achado.projeto.arquivado

  const podeRemover = (e: Evidencia) =>
    aberto && (temPapel('Analista', 'Administrador') || e.enviadaPor.id === eu.id)

  return (
    <section className="rounded-lg border bg-card p-5 md:p-6">
      <h2 className="mb-4 text-base font-semibold">Evidências</h2>
      {evidencias.isPending ? (
        <Carregando />
      ) : evidencias.isError ? (
        <MensagemErro erro={evidencias.error} />
      ) : evidencias.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma evidência anexada.</p>
      ) : (
        <ul className="grid gap-2">
          {evidencias.data.map((e) => {
            const url = `/api/evidencias/${e.id}/download`
            return (
              <li key={e.id} className="evidencia flex items-start gap-3 rounded-md border p-3">
                {ehImagem(e) ? (
                  <a
                    href={url}
                    className="shrink-0 overflow-hidden rounded-sm border"
                    title="Baixar imagem"
                  >
                    <img
                      src={url}
                      alt={e.descricao ?? e.nomeOriginal}
                      loading="lazy"
                      className="size-16 object-cover"
                    />
                  </a>
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
                    <FileIcon className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={url}
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {e.nomeOriginal}
                  </a>
                  {e.descricao && <p className="texto-pre text-sm">{e.descricao}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatarTamanho(e.tamanhoBytes)}, enviada por {e.enviadaPor.nome} em{' '}
                    {formatarDataHora(e.enviadaEm)}
                  </p>
                  <p
                    className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                    title={e.hashSha256}
                  >
                    SHA-256 {e.hashSha256}
                  </p>
                </div>
                {podeRemover(e) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remover ${e.nomeOriginal}`}
                        onClick={() => {
                          remover.reset()
                          setAlvo(e)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remover</TooltipContent>
                  </Tooltip>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {achado.acoes.anexarEvidencia && <FormularioEnvio achadoId={achado.id} />}

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo="Remover evidência?"
        mensagem={
          <>
            <span className="font-medium text-foreground">{alvo?.nomeOriginal}</span> será excluída.
            A remoção fica registrada no histórico.
          </>
        }
        rotuloConfirmar="Remover evidência"
        perigo
        ocupado={remover.isPending}
        erro={remover.isError ? mensagemDeErro(remover.error) : null}
        aoConfirmar={() =>
          alvo &&
          remover.mutate(alvo.id, {
            onSuccess: () => {
              toast.success('Evidência removida')
              setAlvo(null)
            },
          })
        }
        aoCancelar={() => setAlvo(null)}
      />
    </section>
  )
}
