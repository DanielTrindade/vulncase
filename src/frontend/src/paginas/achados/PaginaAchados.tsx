import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_ACHADO,
  type CampoOrdenacao,
} from '@vulncase/compartilhado'
import { useAchados, useCategoriasOwasp } from '../../api/achados'
import { useAtivos, useProjetos } from '../../api/projetos'
import { useResponsaveis } from '../../api/usuarios'
import { useSessao, useUsuario } from '../../auth/sessao'
import { formatarData } from '../../componentes/datas'
import { Carregando, MensagemErro, Vazio } from '../../componentes/estado'
import { SeloSeveridade, SeloStatus } from '../../componentes/selos'
import { consultaDaUrl, ordenacaoDaUrl } from './filtros-url'

const ROTULOS_ORDENACAO: Record<CampoOrdenacao, string> = {
  criadoEm: 'Data de registro',
  severidade: 'Severidade',
  dataLimite: 'Data-limite',
}

export function PaginaAchados() {
  const usuario = useUsuario()
  const { temPapel } = useSessao()
  const gestor = temPapel('Analista', 'Administrador')
  const [params, setParams] = useSearchParams()
  const consulta = consultaDaUrl(params)
  const achados = useAchados(consulta)
  const projetos = useProjetos(false)
  const categorias = useCategoriasOwasp()
  const ativos = useAtivos(params.get('projetoId') ?? undefined)
  const responsaveis = useResponsaveis(gestor)
  const { campo, ordem } = ordenacaoDaUrl(params)

  /** Altera parâmetros da URL; qualquer filtro novo volta para a primeira página. */
  function alterar(mudancas: Record<string, string | string[] | null>, manterPagina = false) {
    const novo = new URLSearchParams(params)
    for (const [nome, valor] of Object.entries(mudancas)) {
      novo.delete(nome)
      if (valor === null) continue
      for (const v of Array.isArray(valor) ? valor : [valor]) if (v !== '') novo.append(nome, v)
    }
    if (!manterPagina) novo.delete('pagina')
    setParams(novo)
  }

  function alternar(nome: 'status' | 'severidade', valor: string) {
    const atuais = params.getAll(nome)
    alterar({
      [nome]: atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor],
    })
  }

  const meus = params.get('responsavelId') === usuario.id
  const temFiltro = [...params.keys()].some(
    (k) => !['ordenarPor', 'ordem', 'pagina', 'tamanhoPagina'].includes(k),
  )

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Achados</h1>
          <p className="cabecalho-pagina__sub">
            {achados.data ? `${achados.data.total} achado(s) encontrado(s)` : 'Consulta de achados'}
          </p>
        </div>
      </div>

      <div className="cartao filtros">
        <CampoBusca
          key={params.get('busca') ?? ''}
          inicial={params.get('busca') ?? ''}
          aoBuscar={(texto) => alterar({ busca: texto || null })}
        />

        <div className="filtros__linha">
          <label className="filtros__campo">
            <span>Projeto</span>
            <select
              value={params.get('projetoId') ?? ''}
              onChange={(e) => alterar({ projetoId: e.target.value || null, ativoId: null })}
            >
              <option value="">Todos os projetos ativos</option>
              {projetos.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prefixo} — {p.nome}
                </option>
              ))}
            </select>
          </label>
          {params.get('projetoId') && (ativos.data?.length ?? 0) > 0 && (
            <label className="filtros__campo">
              <span>Ativo</span>
              <select
                value={params.get('ativoId') ?? ''}
                onChange={(e) => alterar({ ativoId: e.target.value || null })}
              >
                <option value="">Todos</option>
                {ativos.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {gestor ? (
            <label className="filtros__campo">
              <span>Responsável</span>
              <select
                value={
                  params.get('semResponsavel') === 'true'
                    ? '__sem'
                    : (params.get('responsavelId') ?? '')
                }
                onChange={(e) =>
                  e.target.value === '__sem'
                    ? alterar({ responsavelId: null, semResponsavel: 'true' })
                    : alterar({ responsavelId: e.target.value || null, semResponsavel: null })
                }
              >
                <option value="">Qualquer</option>
                <option value="__sem">Sem responsável</option>
                {responsaveis.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="caixa-selecao filtros__campo--caixa">
              <input
                type="checkbox"
                checked={meus}
                onChange={() =>
                  alterar({ responsavelId: meus ? null : usuario.id, semResponsavel: null })
                }
              />
              Somente atribuídos a mim
            </label>
          )}
          <label className="filtros__campo">
            <span>Categoria OWASP</span>
            <select
              value={params.get('categoriaOwaspId') ?? ''}
              onChange={(e) => alterar({ categoriaOwaspId: e.target.value || null })}
            >
              <option value="">Todas</option>
              {categorias.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}:{c.versao} {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="caixa-selecao filtros__campo--caixa">
            <input
              type="checkbox"
              checked={params.get('vencido') === 'true'}
              onChange={(e) => alterar({ vencido: e.target.checked ? 'true' : null })}
            />
            Somente vencidos
          </label>
        </div>

        <fieldset className="filtros__grupo">
          <legend>Severidade</legend>
          {SEVERIDADES.map((s) => (
            <label
              key={s}
              className={`chip ${params.getAll('severidade').includes(s) ? 'chip--ativo' : ''}`}
            >
              <input
                type="checkbox"
                checked={params.getAll('severidade').includes(s)}
                onChange={() => alternar('severidade', s)}
              />
              {ROTULOS_SEVERIDADE[s]}
            </label>
          ))}
        </fieldset>
        <fieldset className="filtros__grupo">
          <legend>Status</legend>
          {STATUS_ACHADO.map((s) => (
            <label
              key={s}
              className={`chip ${params.getAll('status').includes(s) ? 'chip--ativo' : ''}`}
            >
              <input
                type="checkbox"
                checked={params.getAll('status').includes(s)}
                onChange={() => alternar('status', s)}
              />
              {ROTULOS_STATUS[s]}
            </label>
          ))}
        </fieldset>

        <div className="filtros__linha filtros__linha--fim">
          <label className="filtros__campo">
            <span>Ordenar por</span>
            <select value={campo} onChange={(e) => alterar({ ordenarPor: e.target.value }, true)}>
              {Object.entries(ROTULOS_ORDENACAO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="filtros__campo">
            <span>Ordem</span>
            <select value={ordem} onChange={(e) => alterar({ ordem: e.target.value }, true)}>
              <option value="desc">
                {campo === 'severidade' ? 'Mais grave primeiro' : 'Mais recente primeiro'}
              </option>
              <option value="asc">
                {campo === 'severidade' ? 'Menos grave primeiro' : 'Mais antigo primeiro'}
              </option>
            </select>
          </label>
          {temFiltro && (
            <button type="button" className="botao botao--discreto" onClick={() => setParams({})}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {achados.isPending ? (
        <Carregando />
      ) : achados.isError ? (
        <MensagemErro erro={achados.error} titulo="Filtros inválidos ou erro na consulta." />
      ) : achados.data.itens.length === 0 ? (
        <Vazio>Nenhum achado corresponde aos filtros.</Vazio>
      ) : (
        <>
          <div className="tabela-contorno" aria-busy={achados.isFetching}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Severidade</th>
                  <th>Status</th>
                  <th>Responsável</th>
                  <th>Data-limite</th>
                </tr>
              </thead>
              <tbody>
                {achados.data.itens.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">
                      <Link to={`/achados/${a.id}`}>{a.codigo}</Link>
                    </td>
                    <td className="tabela__titulo">
                      <Link to={`/achados/${a.id}`} className="link-discreto">
                        {a.titulo}
                      </Link>
                      <span className="texto-suave tabela__sub">{a.projeto.nome}</span>
                    </td>
                    <td>
                      <SeloSeveridade severidade={a.severidade} />
                    </td>
                    <td>
                      <SeloStatus status={a.status} />
                    </td>
                    <td>{a.responsavel?.nome ?? <span className="texto-suave">—</span>}</td>
                    <td>
                      {formatarData(a.dataLimite)}
                      {a.vencido && <span className="selo selo--vencido"> Vencido</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="paginacao">
            <span>
              Página {achados.data.pagina} de {achados.data.totalPaginas} · {achados.data.total}{' '}
              achado(s)
            </span>
            <div className="acoes">
              <button
                type="button"
                className="botao botao--pequeno"
                disabled={achados.data.pagina <= 1}
                onClick={() => alterar({ pagina: String(achados.data.pagina - 1) }, true)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="botao botao--pequeno"
                disabled={achados.data.pagina >= achados.data.totalPaginas}
                onClick={() => alterar({ pagina: String(achados.data.pagina + 1) }, true)}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/** Campo de busca: só altera a URL ao enviar; recriado quando a URL muda (key). */
function CampoBusca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (texto: string) => void }) {
  const [busca, setBusca] = useState(inicial)
  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    aoBuscar(busca.trim())
  }
  return (
    <form className="filtros__busca" onSubmit={aoEnviar} role="search">
      <input
        type="search"
        placeholder="Buscar por título ou código…"
        aria-label="Buscar por título ou código"
        maxLength={100}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <button type="submit" className="botao">
        Buscar
      </button>
    </form>
  )
}
