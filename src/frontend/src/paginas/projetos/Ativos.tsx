import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CircleAlertIcon, PlusIcon } from 'lucide-react'
import {
  AMBIENTES,
  esquemaAtivo,
  ROTULOS_AMBIENTE,
  ROTULOS_TIPO_ATIVO,
  TIPOS_ATIVO,
  type FormularioAtivo,
} from '@vulncase/compartilhado'
import type { z } from 'zod'
import { useAtivos, useCriarAtivo } from '@/api/projetos'
import { Painel } from '@/componentes/cabecalho'
import { Campo } from '@/componentes/campo'
import { Carregando, MensagemErro } from '@/componentes/estado'
import { aplicarErrosApi } from '@/componentes/formulario'
import { Alert, AlertDescription } from '@/componentes/ui/alert'
import { Button } from '@/componentes/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import { Input } from '@/componentes/ui/input'
import { NativeSelect, NativeSelectOption } from '@/componentes/ui/native-select'
import { Spinner } from '@/componentes/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/componentes/ui/table'

function NovoAtivo({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const criar = useCriarAtivo(projetoId)
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormularioAtivo, unknown, z.output<typeof esquemaAtivo>>({
    resolver: zodResolver(esquemaAtivo),
    defaultValues: { nome: '', tipo: 'AplicacaoWeb', identificador: '', ambiente: 'Laboratorio' },
  })
  const aoEnviar = handleSubmit(async (dados) => {
    setErro(null)
    try {
      const a = await criar.mutateAsync(dados)
      toast.success(`Ativo ${a.nome} cadastrado`)
      aoFechar()
    } catch (err) {
      setErro(aplicarErrosApi(err, setError, ['nome', 'tipo', 'identificador', 'ambiente']))
    }
  })
  return (
    <form className="grid gap-5" onSubmit={(e) => void aoEnviar(e)} noValidate>
      {erro && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" erro={errors.nome?.message} obrigatorio>
        <Input maxLength={120} {...register('nome')} />
      </Campo>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo rotulo="Tipo" erro={errors.tipo?.message} obrigatorio>
          <NativeSelect {...register('tipo')}>
            {TIPOS_ATIVO.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {ROTULOS_TIPO_ATIVO[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
        <Campo rotulo="Ambiente" erro={errors.ambiente?.message} obrigatorio>
          <NativeSelect {...register('ambiente')}>
            {AMBIENTES.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {ROTULOS_AMBIENTE[a]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
      </div>
      <Campo
        rotulo="Identificador"
        erro={errors.identificador?.message}
        ajuda="URL, IP, host ou repositório."
        obrigatorio
      >
        <Input maxLength={500} className="font-mono" {...register('identificador')} />
      </Campo>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={criar.isPending}>
          {criar.isPending && <Spinner />}
          Cadastrar ativo
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Ativos do projeto (RF11), na página do projeto. */
export function Ativos({
  projetoId,
  podeGerenciar,
}: {
  projetoId: string
  podeGerenciar: boolean
}) {
  const ativos = useAtivos(projetoId)
  const [criando, setCriando] = useState(false)
  return (
    <Painel
      titulo="Ativos"
      acoes={
        podeGerenciar && (
          <Button variant="outline" size="sm" onClick={() => setCriando(true)}>
            <PlusIcon />
            Novo ativo
          </Button>
        )
      }
    >
      {ativos.isPending ? (
        <Carregando />
      ) : ativos.isError ? (
        <MensagemErro erro={ativos.error} />
      ) : ativos.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum ativo cadastrado. Ativos são as aplicações, APIs, servidores ou repositórios
          analisados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead className="text-right">Achados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ativos.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.nome}</TableCell>
                <TableCell>{ROTULOS_TIPO_ATIVO[a.tipo]}</TableCell>
                <TableCell className="max-w-[280px] truncate font-mono text-[13px]">
                  {a.identificador}
                </TableCell>
                <TableCell>{ROTULOS_AMBIENTE[a.ambiente]}</TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/achados?projetoId=${projetoId}&ativoId=${a.id}`}
                    className="text-primary hover:underline"
                  >
                    Ver achados
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo ativo</DialogTitle>
            <DialogDescription>
              Ativos podem ser vinculados aos achados do projeto.
            </DialogDescription>
          </DialogHeader>
          {criando && <NovoAtivo projetoId={projetoId} aoFechar={() => setCriando(false)} />}
        </DialogContent>
      </Dialog>
    </Painel>
  )
}
