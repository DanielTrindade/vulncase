import { useRef, useState, type FormEvent } from 'react'
import { ErroApi, mensagemDeErro } from '../../api/cliente'
import {
  useEnviarEvidencia,
  useEvidencias,
  useRemoverEvidencia,
  type Achado,
  type Evidencia,
} from '../../api/achados'
import { useSessao, useUsuario } from '../../auth/sessao'
import { formatarDataHora } from '../../componentes/datas'
import { DialogoConfirmacao } from '../../componentes/dialogo'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'

const TAMANHO_MAXIMO = 5 * 1024 * 1024
const EXTENSOES = '.png,.jpg,.jpeg,.pdf,.txt,.pcap,.pcapng'

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function mensagemEnvio(err: unknown): string {
  if (err instanceof ErroApi) {
    if (err.status === 413) return 'O arquivo excede o limite de 5 MB.'
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

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!arquivo) return setErro('Escolha um arquivo.')
    if (arquivo.size > TAMANHO_MAXIMO) return setErro('O arquivo excede o limite de 5 MB.')
    try {
      await enviar.mutateAsync({ arquivo, descricao })
      setArquivo(null)
      setDescricao('')
      if (entrada.current) entrada.current.value = ''
    } catch (err) {
      setErro(mensagemEnvio(err))
    }
  }

  return (
    <form className="envio-evidencia" onSubmit={(e) => void aoEnviar(e)}>
      {erro && (
        <div className="alerta alerta--erro" role="alert">
          {erro}
        </div>
      )}
      <div className="linha-campos">
        <label className="campo">
          <span className="campo__rotulo">Arquivo</span>
          <input
            ref={entrada}
            type="file"
            accept={EXTENSOES}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <span className="campo__ajuda">PNG, JPG, PDF, TXT, PCAP ou PCAPNG, até 5 MB.</span>
        </label>
        <label className="campo">
          <span className="campo__rotulo">Descrição (opcional)</span>
          <input maxLength={500} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </div>
      <div className="acoes">
        <button type="submit" className="botao" disabled={!arquivo || enviar.isPending}>
          {enviar.isPending ? 'Enviando…' : 'Anexar evidência'}
        </button>
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
    <div className="cartao">
      <h2>Evidências</h2>
      {evidencias.isPending ? (
        <Carregando />
      ) : evidencias.isError ? (
        <MensagemErro erro={evidencias.error} />
      ) : evidencias.data.length === 0 ? (
        <Vazio>Nenhuma evidência anexada.</Vazio>
      ) : (
        <ul className="evidencias">
          {evidencias.data.map((e) => {
            const url = `/api/evidencias/${e.id}/download`
            return (
              <li key={e.id} className="evidencia">
                {ehImagem(e) && (
                  <a href={url} className="evidencia__miniatura" title="Baixar imagem">
                    <img src={url} alt={e.descricao ?? e.nomeOriginal} loading="lazy" />
                  </a>
                )}
                <div className="evidencia__dados">
                  <a href={url} className="evidencia__nome">
                    {e.nomeOriginal}
                  </a>
                  {e.descricao && <span className="texto-pre">{e.descricao}</span>}
                  <span className="texto-suave evidencia__meta">
                    {formatarTamanho(e.tamanhoBytes)} · {e.enviadaPor.nome} ·{' '}
                    {formatarDataHora(e.enviadaEm)}
                  </span>
                  <code className="evidencia__hash" title="SHA-256">
                    SHA-256 {e.hashSha256}
                  </code>
                </div>
                {podeRemover(e) && (
                  <button
                    type="button"
                    className="botao botao--perigo botao--pequeno"
                    onClick={() => {
                      remover.reset()
                      setAlvo(e)
                    }}
                  >
                    Remover
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {achado.acoes.anexarEvidencia && <FormularioEnvio achadoId={achado.id} />}

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo="Remover evidência"
        mensagem={
          <>
            A evidência <strong>{alvo?.nomeOriginal}</strong> será excluída. A remoção fica
            registrada no histórico.
          </>
        }
        rotuloConfirmar="Remover"
        perigo
        ocupado={remover.isPending}
        erro={remover.isError ? mensagemDeErro(remover.error) : null}
        aoConfirmar={() => alvo && remover.mutate(alvo.id, { onSuccess: () => setAlvo(null) })}
        aoCancelar={() => setAlvo(null)}
      />
    </div>
  )
}
