import { toast } from 'sonner'
import { UserRoundIcon } from 'lucide-react'
import { ErroApi, mensagemDeErro } from '@/api/cliente'
import { useAtribuirResponsavel, type Achado } from '@/api/achados'
import { useResponsaveis } from '@/api/usuarios'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/componentes/ui/select'

const SEM = '__sem'

/** Exibe o responsável e, quando permitido, atribui, troca ou remove (RF15). */
export function Responsavel({ achado, aoConflito }: { achado: Achado; aoConflito: () => void }) {
  const pode = achado.acoes.atribuirResponsavel
  const responsaveis = useResponsaveis(pode)
  const atribuir = useAtribuirResponsavel()

  async function salvar(valor: string) {
    const responsavelId = valor === SEM ? null : valor
    if (responsavelId === (achado.responsavel?.id ?? null)) return
    try {
      const novo = await atribuir.mutateAsync({
        id: achado.id,
        dados: { responsavelId, versao: achado.versao },
      })
      toast.success(
        novo.responsavel ? `Atribuído a ${novo.responsavel.nome}` : 'Responsável removido',
      )
      if (!responsavelId && achado.status === 'EmCorrecao')
        toast.info('O achado voltou para Aberto.')
    } catch (err) {
      if (err instanceof ErroApi && err.problema.title === 'Conflito de versão') aoConflito()
      else toast.error(mensagemDeErro(err))
    }
  }

  if (!pode) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <UserRoundIcon className="size-4 text-muted-foreground" />
        {achado.responsavel?.nome ?? <span className="text-muted-foreground">Sem responsável</span>}
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      <Select
        value={achado.responsavel?.id ?? SEM}
        onValueChange={(v) => void salvar(v)}
        disabled={atribuir.isPending}
      >
        <SelectTrigger aria-label="Responsável" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM}>Sem responsável</SelectItem>
          <SelectSeparator />
          {/* Mantém o responsável atual na lista mesmo que tenha sido desativado. */}
          {achado.responsavel &&
            !responsaveis.data?.some((u) => u.id === achado.responsavel?.id) && (
              <SelectItem value={achado.responsavel.id}>{achado.responsavel.nome}</SelectItem>
            )}
          {responsaveis.data?.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {achado.status === 'EmCorrecao' && (
        <p className="text-xs text-muted-foreground">
          Remover o responsável devolve o achado para Aberto.
        </p>
      )}
    </div>
  )
}
