import { useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import {
  esquemaCriarAchado,
  esquemaEditarAchado,
  ORIGENS_ACHADO,
  ROTULOS_ORIGEM,
  ROTULOS_SEVERIDADE,
  SEVERIDADES,
  type EntradaCriarAchado,
  type EntradaEditarAchado,
  type OrigemAchado,
  type Severidade,
} from '@vulncase/compartilhado'
import { ErroApi } from '../../api/cliente'
import {
  useCategoriasOwasp,
  useEditarAchado,
  useRegistrarAchado,
  type Achado,
} from '../../api/achados'
import { useResponsaveis } from '../../api/usuarios'
import { Campo } from '../../componentes/campo'
import { aplicarErrosApi } from '../../componentes/formulario'

/** Valores do formulário: campos numéricos opcionais aceitam vazio (null). */
interface ValoresFormulario {
  titulo: string
  descricao: string
  origem: OrigemAchado
  severidade: Severidade
  localizacao: string
  impacto: string
  passosReproducao: string
  correcaoProposta: string
  categoriaOwaspId: number | null
  cweId: number | null
  cveId: string
  notaCvss: number | null
  responsavelId?: string | null
  versao?: number
}

const CAMPOS = [
  'titulo',
  'descricao',
  'origem',
  'severidade',
  'localizacao',
  'impacto',
  'passosReproducao',
  'correcaoProposta',
  'categoriaOwaspId',
  'cweId',
  'cveId',
  'notaCvss',
  'responsavelId',
] as const

const numeroOuNulo = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

/**
 * Os esquemas compartilhados são estritos: a edição não aceita responsavelId e o
 * registro não aceita versao, então cada modo só inclui as próprias chaves.
 */
function valoresIniciais(achado?: Achado): ValoresFormulario {
  const comuns = {
    titulo: achado?.titulo ?? '',
    descricao: achado?.descricao ?? '',
    origem: achado?.origem ?? 'TesteAplicacaoWeb',
    severidade: achado?.severidade ?? 'Media',
    localizacao: achado?.localizacao ?? '',
    impacto: achado?.impacto ?? '',
    passosReproducao: achado?.passosReproducao ?? '',
    correcaoProposta: achado?.correcaoProposta ?? '',
    categoriaOwaspId: achado?.categoriaOwasp?.id ?? null,
    cweId: achado?.cweId ?? null,
    cveId: achado?.cveId ?? '',
    notaCvss: achado?.notaCvss ?? null,
  }
  return achado ? { ...comuns, versao: achado.versao } : { ...comuns, responsavelId: null }
}

interface Props {
  /** Edição quando informado; registro caso contrário. */
  achado?: Achado
  projetoId: string
  /** Recarrega o achado do servidor (conflito de versão). */
  aoRecarregar?: () => Promise<Achado | undefined>
}

export function FormularioAchado({ achado, projetoId, aoRecarregar }: Props) {
  const edicao = achado !== undefined
  const navegar = useNavigate()
  const registrar = useRegistrarAchado()
  const editar = useEditarAchado()
  const categorias = useCategoriasOwasp()
  const responsaveis = useResponsaveis(!edicao)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [conflito, setConflito] = useState(false)

  const esquema = edicao ? esquemaEditarAchado : esquemaCriarAchado
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ValoresFormulario>({
    // O esquema compartilhado valida e normaliza; a saída é enviada à API.
    resolver: zodResolver(esquema) as unknown as Resolver<ValoresFormulario>,
    defaultValues: valoresIniciais(achado),
  })
  const cwe = useWatch({ control, name: 'cweId' })

  const aoEnviar = handleSubmit(async (dados) => {
    setErroGeral(null)
    setConflito(false)
    try {
      if (edicao) {
        const salvo = await editar.mutateAsync({
          id: achado.id,
          dados: dados as EntradaEditarAchado,
        })
        navegar(`/achados/${salvo.id}`)
      } else {
        const salvo = await registrar.mutateAsync({ projetoId, dados: dados as EntradaCriarAchado })
        navegar(`/achados/${salvo.id}`)
      }
    } catch (err) {
      if (err instanceof ErroApi && err.status === 409 && edicao) setConflito(true)
      // Os valores digitados permanecem no formulário.
      setErroGeral(aplicarErrosApi(err, setError, CAMPOS))
    }
  })

  async function recarregar() {
    const atual = await aoRecarregar?.()
    if (atual) reset(valoresIniciais(atual))
    setConflito(false)
    setErroGeral(null)
  }

  const cweValido = typeof cwe === 'number' && Number.isInteger(cwe) && cwe > 0

  return (
    <form
      className="cartao formulario formulario--largo"
      onSubmit={(e) => void aoEnviar(e)}
      noValidate
    >
      {erroGeral && (
        <div className="alerta alerta--erro" role="alert">
          {erroGeral}
          {conflito && (
            <div className="acoes" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="botao botao--pequeno"
                onClick={() => void recarregar()}
              >
                Recarregar dados atuais (descarta suas alterações)
              </button>
            </div>
          )}
        </div>
      )}

      <Campo rotulo="Título" erro={errors.titulo?.message} obrigatorio>
        <input maxLength={160} {...register('titulo')} />
      </Campo>

      <div className="linha-campos">
        <Campo rotulo="Origem" erro={errors.origem?.message} obrigatorio>
          <select {...register('origem')}>
            {ORIGENS_ACHADO.map((o) => (
              <option key={o} value={o}>
                {ROTULOS_ORIGEM[o]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Severidade" erro={errors.severidade?.message} obrigatorio>
          <select {...register('severidade')}>
            {SEVERIDADES.map((s) => (
              <option key={s} value={s}>
                {ROTULOS_SEVERIDADE[s]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo="Localização"
          erro={errors.localizacao?.message}
          ajuda="URL, rota, arquivo e linha, ou host e porta."
          obrigatorio
        >
          <input maxLength={500} className="mono" {...register('localizacao')} />
        </Campo>
      </div>

      <div className="linha-campos">
        <Campo rotulo="Categoria OWASP Top 10" erro={errors.categoriaOwaspId?.message}>
          <select {...register('categoriaOwaspId', { setValueAs: numeroOuNulo })}>
            <option value="">Não classificado</option>
            {categorias.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}:{c.versao} — {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo="CWE"
          erro={errors.cweId?.message}
          ajuda={
            cweValido ? (
              <a
                href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver CWE-{cwe} no site do MITRE
              </a>
            ) : (
              'Somente o número, ex.: 79.'
            )
          }
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            {...register('cweId', { setValueAs: numeroOuNulo })}
          />
        </Campo>
        <Campo rotulo="CVE" erro={errors.cveId?.message} ajuda="Opcional, ex.: CVE-2021-44228.">
          <input className="mono" maxLength={20} {...register('cveId')} />
        </Campo>
        <Campo rotulo="Nota CVSS" erro={errors.notaCvss?.message} ajuda="Opcional, de 0,0 a 10,0.">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={10}
            step={0.1}
            {...register('notaCvss', { setValueAs: numeroOuNulo })}
          />
        </Campo>
      </div>

      {!edicao && (
        <Campo
          rotulo="Responsável"
          erro={errors.responsavelId?.message}
          ajuda="Opcional; pode ser definido depois."
        >
          <select {...register('responsavelId', { setValueAs: (v: string) => v || null })}>
            <option value="">Sem responsável</option>
            {responsaveis.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}

      <Campo rotulo="Descrição" erro={errors.descricao?.message} obrigatorio>
        <textarea rows={5} maxLength={10_000} {...register('descricao')} />
      </Campo>
      <Campo rotulo="Impacto" erro={errors.impacto?.message} ajuda="Consequência da exploração.">
        <textarea rows={3} maxLength={4000} {...register('impacto')} />
      </Campo>
      <Campo rotulo="Passos de reprodução" erro={errors.passosReproducao?.message}>
        <textarea rows={5} maxLength={10_000} className="mono" {...register('passosReproducao')} />
      </Campo>
      <Campo rotulo="Correção proposta" erro={errors.correcaoProposta?.message} obrigatorio>
        <textarea rows={4} maxLength={10_000} {...register('correcaoProposta')} />
      </Campo>

      <div className="acoes">
        <button type="submit" className="botao botao--primario" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Registrar achado'}
        </button>
        <Link to={edicao ? `/achados/${achado.id}` : `/projetos/${projetoId}`} className="botao">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
