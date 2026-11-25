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
import { toast } from 'sonner'
import { CircleAlertIcon, ExternalLinkIcon, RotateCcwIcon } from 'lucide-react'
import { ErroApi } from '@/api/cliente'
import { useCategoriasOwasp, useEditarAchado, useRegistrarAchado, type Achado } from '@/api/achados'
import { useAtivos } from '@/api/projetos'
import { useResponsaveis } from '@/api/usuarios'
import { Campo } from '@/componentes/campo'
import { aplicarErrosApi } from '@/componentes/formulario'
import { Alert, AlertDescription, AlertTitle } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { NativeSelect, NativeSelectOption } from '@/componentes/ui/native-select'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'
import type { ReactNode } from 'react'

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
  ativoId: string | null
  cweId: number | null
  cveId: string
  notaCvss: number | null
  dataLimite: string
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
  'ativoId',
  'cweId',
  'cveId',
  'notaCvss',
  'responsavelId',
  'dataLimite',
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
    ativoId: achado?.ativo?.id ?? null,
    cweId: achado?.cweId ?? null,
    cveId: achado?.cveId ?? '',
    notaCvss: achado?.notaCvss ?? null,
    dataLimite: achado?.dataLimite ?? '',
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
  const ativos = useAtivos(projetoId)
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
        toast.success('Alterações salvas')
        navegar(`/achados/${salvo.id}`)
      } else {
        const salvo = await registrar.mutateAsync({ projetoId, dados: dados as EntradaCriarAchado })
        toast.success(`Achado ${salvo.codigo} registrado`)
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
    <form className="grid gap-6" onSubmit={(e) => void aoEnviar(e)} noValidate>
      {erroGeral && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>
            {conflito ? 'Outra pessoa alterou este achado' : 'Não foi possível salvar'}
          </AlertTitle>
          <AlertDescription>
            <p>{erroGeral}</p>
            {conflito && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void recarregar()}
              >
                <RotateCcwIcon />
                Recarregar dados atuais (descarta suas alterações)
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Secao titulo="Identificação" descricao="O que foi encontrado e onde.">
        <Campo rotulo="Título" erro={errors.titulo?.message} obrigatorio>
          <Input maxLength={160} {...register('titulo')} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Origem" erro={errors.origem?.message} obrigatorio>
            <NativeSelect {...register('origem')}>
              {ORIGENS_ACHADO.map((o) => (
                <NativeSelectOption key={o} value={o}>
                  {ROTULOS_ORIGEM[o]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Severidade" erro={errors.severidade?.message} obrigatorio>
            <NativeSelect {...register('severidade')}>
              {SEVERIDADES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {ROTULOS_SEVERIDADE[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Campo>
        </div>
        <Campo
          rotulo="Localização"
          erro={errors.localizacao?.message}
          ajuda="URL, rota, arquivo e linha, ou host e porta."
          obrigatorio
        >
          <Input maxLength={500} className="font-mono" {...register('localizacao')} />
        </Campo>
        <Campo
          rotulo="Ativo afetado"
          erro={errors.ativoId?.message}
          ajuda="Opcional; ativos cadastrados no projeto."
        >
          <NativeSelect {...register('ativoId', { setValueAs: (v: string | null) => v || null })}>
            <NativeSelectOption value="">Nenhum</NativeSelectOption>
            {ativos.data?.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.nome} ({a.identificador})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
      </Secao>

      <Secao
        titulo="Classificação"
        descricao="Referências que ajudam a priorizar e a pesquisar a correção."
      >
        <Campo rotulo="Categoria OWASP Top 10" erro={errors.categoriaOwaspId?.message}>
          <NativeSelect {...register('categoriaOwaspId', { setValueAs: numeroOuNulo })}>
            <NativeSelectOption value="">Não classificado</NativeSelectOption>
            {categorias.data?.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.codigo}:{c.versao} {c.nome}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
        <div className="grid gap-5 sm:grid-cols-3">
          <Campo
            rotulo="CWE"
            erro={errors.cweId?.message}
            ajuda={
              cweValido ? (
                <a
                  href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver CWE-{cwe} no MITRE
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                'Só o número, ex.: 79.'
              )
            }
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register('cweId', { setValueAs: numeroOuNulo })}
            />
          </Campo>
          <Campo rotulo="CVE" erro={errors.cveId?.message} ajuda="Opcional, ex.: CVE-2021-44228.">
            <Input className="font-mono" maxLength={20} {...register('cveId')} />
          </Campo>
          <Campo
            rotulo="Nota CVSS"
            erro={errors.notaCvss?.message}
            ajuda="Opcional, de 0,0 a 10,0."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              step={0.1}
              {...register('notaCvss', { setValueAs: numeroOuNulo })}
            />
          </Campo>
        </div>
      </Secao>

      <Secao
        titulo="Detalhes técnicos"
        descricao="O suficiente para outra pessoa reproduzir e entender o risco."
      >
        <Campo rotulo="Descrição" erro={errors.descricao?.message} obrigatorio>
          <Textarea rows={5} maxLength={10_000} {...register('descricao')} />
        </Campo>
        <Campo
          rotulo="Impacto"
          erro={errors.impacto?.message}
          ajuda="O que um atacante consegue ao explorar."
        >
          <Textarea rows={3} maxLength={4000} {...register('impacto')} />
        </Campo>
        <Campo rotulo="Passos de reprodução" erro={errors.passosReproducao?.message}>
          <Textarea
            rows={5}
            maxLength={10_000}
            className="font-mono text-[13px]"
            {...register('passosReproducao')}
          />
        </Campo>
      </Secao>

      <Secao titulo="Correção e prazo" descricao="Como corrigir, até quando e com quem.">
        <Campo rotulo="Correção proposta" erro={errors.correcaoProposta?.message} obrigatorio>
          <Textarea rows={4} maxLength={10_000} {...register('correcaoProposta')} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Data-limite de correção"
            erro={errors.dataLimite?.message}
            ajuda={
              edicao
                ? 'Alterar fixa a data manualmente; em branco, o achado fica sem prazo.'
                : 'Em branco, vem da severidade: Crítica 7 dias, Alta 30, Média 90, Baixa 180.'
            }
          >
            <Input type="date" {...register('dataLimite')} />
          </Campo>
          {!edicao && (
            <Campo
              rotulo="Responsável"
              erro={errors.responsavelId?.message}
              ajuda="Opcional; pode ser definido depois."
            >
              <NativeSelect
                {...register('responsavelId', { setValueAs: (v: string) => v || null })}
              >
                <NativeSelectOption value="">Sem responsável</NativeSelectOption>
                {responsaveis.data?.map((u) => (
                  <NativeSelectOption key={u.id} value={u.id}>
                    {u.nome}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Campo>
          )}
        </div>
      </Secao>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border md:px-5">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {edicao ? 'Salvar alterações' : 'Registrar achado'}
        </Button>
        <Button asChild variant="outline">
          <Link to={edicao ? `/achados/${achado.id}` : `/projetos/${projetoId}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}

/** Seção do formulário: título e descrição à esquerda, campos à direita. */
function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-6 rounded-lg border bg-card p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  )
}
