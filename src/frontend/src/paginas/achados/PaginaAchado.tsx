import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ROTULOS_ORIGEM } from '@vulncase/compartilhado'
import { useAchado, type Achado } from '../../api/achados'
import { formatarData, formatarDataHora } from '../../componentes/datas'
import { Carregando, MensagemErro } from '../../componentes/estado'
import { SeloSeveridade, SeloStatus } from '../../componentes/selos'
import { DialogoTransicao } from './DialogoTransicao'
import { Evidencias } from './Evidencias'
import { Historico } from './Historico'
import { Responsavel } from './Responsavel'

type Acao = Achado['acoes']['transicoes'][number]

/** Bloco de texto cadastrado: sempre exibido como texto, nunca como HTML (RNF09). */
function Texto({ titulo, children }: { titulo: string; children: string | null }) {
  if (!children) return null
  return (
    <div className="bloco-texto">
      <h3>{titulo}</h3>
      <p className="texto-pre">{children}</p>
    </div>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </>
  )
}

export function PaginaAchado() {
  const { id } = useParams()
  const achado = useAchado(id)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [conflito, setConflito] = useState(false)

  if (achado.isPending) return <Carregando />
  if (achado.isError) return <MensagemErro erro={achado.error} />
  const a = achado.data

  async function recarregar() {
    await achado.refetch()
    setConflito(false)
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <p className="cabecalho-pagina__sub">
            <Link to={`/projetos/${a.projeto.id}`}>{a.projeto.nome}</Link> ·{' '}
            <span className="mono">{a.codigo}</span>
          </p>
          <h1 className="titulo-achado">{a.titulo}</h1>
          <div className="acoes">
            <SeloSeveridade severidade={a.severidade} />
            <SeloStatus status={a.status} />
            {a.vencido && <span className="selo selo--vencido">Vencido</span>}
          </div>
        </div>
        <div className="acoes">
          {a.acoes.transicoes.map((t) => (
            <button key={t.destino} type="button" className="botao" onClick={() => setAcao(t)}>
              {t.rotulo}
            </button>
          ))}
          {a.acoes.editar && (
            <Link to={`/achados/${a.id}/editar`} className="botao">
              Editar
            </Link>
          )}
        </div>
      </div>

      {conflito && (
        <div className="alerta alerta--aviso" role="alert">
          O achado foi alterado por outra pessoa. Recarregue para ver a versão atual antes de tentar
          novamente.{' '}
          <button type="button" className="botao botao--pequeno" onClick={() => void recarregar()}>
            Recarregar
          </button>
        </div>
      )}

      <div className="detalhe">
        <div className="detalhe__principal">
          <div className="cartao">
            <Texto titulo="Descrição">{a.descricao}</Texto>
            <Texto titulo="Impacto">{a.impacto}</Texto>
            <Texto titulo="Passos de reprodução">{a.passosReproducao}</Texto>
            <Texto titulo="Correção proposta">{a.correcaoProposta}</Texto>
          </div>
          <Evidencias achado={a} />
          <div className="cartao">
            <h2>Histórico e comentários</h2>
            <Historico achadoId={a.id} podeComentar={a.acoes.comentar} />
          </div>
        </div>

        <aside className="detalhe__lateral">
          <div className="cartao">
            <dl className="lista-dados lista-dados--vertical">
              <Item rotulo="Responsável">
                <Responsavel
                  key={`${a.versao}-${a.responsavel?.id ?? ''}`}
                  achado={a}
                  aoConflito={() => setConflito(true)}
                />
              </Item>
              {a.ativo && (
                <Item rotulo="Ativo">
                  {a.ativo.nome}{' '}
                  <span className="mono texto-suave quebra">{a.ativo.identificador}</span>
                </Item>
              )}
              <Item rotulo="Origem">{ROTULOS_ORIGEM[a.origem]}</Item>
              <Item rotulo="Localização">
                <span className="mono quebra">{a.localizacao}</span>
              </Item>
              <Item rotulo="Categoria OWASP">
                {a.categoriaOwasp
                  ? `${a.categoriaOwasp.codigo}:${a.categoriaOwasp.versao} ${a.categoriaOwasp.nome}`
                  : '—'}
              </Item>
              <Item rotulo="CWE">
                {a.cweId ? (
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${a.cweId}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CWE-{a.cweId}
                  </a>
                ) : (
                  '—'
                )}
              </Item>
              {a.cveId && <Item rotulo="CVE">{a.cveId}</Item>}
              {a.notaCvss !== null && <Item rotulo="Nota CVSS">{a.notaCvss.toFixed(1)}</Item>}
              <Item rotulo="Data-limite">
                {formatarData(a.dataLimite)}
                {a.vencido && <span className="selo selo--vencido"> Vencido</span>}
                {a.dataLimiteManual && <span className="texto-suave"> (ajustada manualmente)</span>}
              </Item>
              <Item rotulo="Registrado por">{a.registradoPor.nome}</Item>
              <Item rotulo="Registrado em">{formatarDataHora(a.criadoEm)}</Item>
              <Item rotulo="Atualizado em">{formatarDataHora(a.atualizadoEm)}</Item>
              {a.encerradoEm && (
                <Item rotulo="Encerrado em">{formatarDataHora(a.encerradoEm)}</Item>
              )}
            </dl>
          </div>
        </aside>
      </div>

      <DialogoTransicao
        achado={a}
        acao={acao}
        aoFechar={() => setAcao(null)}
        aoConflito={() => setConflito(true)}
      />
    </section>
  )
}
