import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  SEVERIDADES,
  STATUS_ACHADO,
  STATUS_NAO_ENCERRADOS,
} from '@vulncase/compartilhado'
import type { Indicadores } from '../api/painel'
import { formatarData } from './datas'
import { Vazio } from './estado'
import { SeloSeveridade, SeloStatus } from './selos'

/** Lê os tokens de cor do tema atual e acompanha a troca claro/escuro. */
function useCoresTema() {
  const ler = () => {
    const s = getComputedStyle(document.documentElement)
    const v = (n: string) => s.getPropertyValue(n).trim()
    return {
      barra: v('--grafico-barra'),
      grade: v('--borda'),
      texto: v('--texto-suave'),
      superficie: v('--superficie'),
    }
  }
  const [cores, setCores] = useState(ler)
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = () => setCores(ler())
    m.addEventListener('change', aoMudar)
    return () => m.removeEventListener('change', aoMudar)
  }, [])
  return cores
}

/** Monta a URL da lista de achados com o filtro do indicador (UC09, passo 3). */
export function urlLista(
  projetoId: string | undefined,
  filtros: Record<string, string | readonly string[]>,
) {
  const p = new URLSearchParams()
  if (projetoId) p.set('projetoId', projetoId)
  for (const [k, v] of Object.entries(filtros))
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, x)
  return `/achados?${p.toString()}`
}

interface Ponto {
  chave: string
  rotulo: string
  total: number
}

function GraficoBarras({
  titulo,
  dados,
  aoClicar,
  horizontal = false,
}: {
  titulo: string
  dados: Ponto[]
  aoClicar: (chave: string) => void
  /** Barras horizontais para rótulos longos (status). */
  horizontal?: boolean
}) {
  const cores = useCoresTema()
  const eixoTexto = { fill: cores.texto, fontSize: 12 }
  return (
    <figure className="cartao grafico">
      <figcaption className="grafico__titulo">{titulo}</figcaption>
      <div className="grafico__area">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={dados}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={
              horizontal
                ? { top: 0, right: 32, bottom: 0, left: 8 }
                : { top: 20, right: 8, bottom: 0, left: -16 }
            }
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={cores.grade} />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={eixoTexto}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="rotulo"
                  width={150}
                  tick={eixoTexto}
                  tickLine={false}
                  axisLine={{ stroke: cores.grade }}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="rotulo"
                  tick={eixoTexto}
                  tickLine={false}
                  axisLine={{ stroke: cores.grade }}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={eixoTexto} tickLine={false} axisLine={false} />
              </>
            )}
            <Tooltip
              cursor={{ fill: cores.grade, opacity: 0.35 }}
              contentStyle={{
                background: cores.superficie,
                border: `1px solid ${cores.grade}`,
                borderRadius: 8,
              }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(v) => [`${String(v)} achado(s)`, 'Total']}
            />
            <Bar
              dataKey="total"
              fill={cores.barra}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 22 : 44}
              cursor="pointer"
              onClick={(d) => aoClicar((d as unknown as { payload: Ponto }).payload.chave)}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="total"
                position={horizontal ? 'right' : 'top'}
                fill={cores.texto}
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Versão em tabela, com os mesmos links, para leitores de tela e para conferência. */}
      <details className="grafico__tabela">
        <summary>Ver como tabela</summary>
        <table className="tabela">
          <tbody>
            {dados.map((d) => (
              <tr key={d.chave}>
                <td>
                  <button type="button" className="botao-link" onClick={() => aoClicar(d.chave)}>
                    {d.rotulo}
                  </button>
                </td>
                <td className="numero">{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function Indicador({
  rotulo,
  valor,
  para,
  destaque,
}: {
  rotulo: string
  valor: number
  para: string
  destaque?: boolean
}) {
  return (
    <Link to={para} className={`indicador ${destaque && valor > 0 ? 'indicador--alerta' : ''}`}>
      <span className="indicador__valor">{valor}</span>
      <span className="indicador__rotulo">{rotulo}</span>
    </Link>
  )
}

/** Indicadores do UC09; todo indicador leva à lista de achados filtrada. */
export function Painel({ dados, projetoId }: { dados: Indicadores; projetoId?: string }) {
  const navegar = useNavigate()
  const abertos = STATUS_NAO_ENCERRADOS
  return (
    <div className="painel">
      <div className="grade grade--4">
        <Indicador
          rotulo="Achados registrados"
          valor={dados.total}
          para={urlLista(projetoId, {})}
        />
        <Indicador
          rotulo="Abertos"
          valor={dados.totalAbertos}
          para={urlLista(projetoId, { status: abertos })}
        />
        <Indicador
          rotulo="Abertos sem responsável"
          valor={dados.semResponsavel}
          para={urlLista(projetoId, { status: abertos, semResponsavel: 'true' })}
          destaque
        />
        <Indicador
          rotulo="Vencidos"
          valor={dados.vencidos}
          para={urlLista(projetoId, { vencido: 'true' })}
          destaque
        />
      </div>

      <div className="grade grade--2">
        <GraficoBarras
          titulo="Achados por severidade"
          dados={SEVERIDADES.map((s) => ({
            chave: s,
            rotulo: ROTULOS_SEVERIDADE[s],
            total: dados.porSeveridade[s],
          }))}
          aoClicar={(s) => navegar(urlLista(projetoId, { severidade: s }))}
        />
        <GraficoBarras
          titulo="Achados por status"
          dados={STATUS_ACHADO.map((s) => ({
            chave: s,
            rotulo: ROTULOS_STATUS[s],
            total: dados.porStatus[s],
          }))}
          aoClicar={(s) => navegar(urlLista(projetoId, { status: s }))}
          horizontal
        />
      </div>

      <div className="cartao">
        <div className="cabecalho-pagina" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>Abertos mais graves</h2>
          <Link to={urlLista(projetoId, { status: abertos, ordenarPor: 'severidade' })}>
            Ver todos
          </Link>
        </div>
        {dados.maisGraves.length === 0 ? (
          <Vazio>Nenhum achado aberto.</Vazio>
        ) : (
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
              {dados.maisGraves.map((a) => (
                <tr key={a.id}>
                  <td className="mono">
                    <Link to={`/achados/${a.id}`}>{a.codigo}</Link>
                  </td>
                  <td className="tabela__titulo">{a.titulo}</td>
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
        )}
      </div>
    </div>
  )
}
