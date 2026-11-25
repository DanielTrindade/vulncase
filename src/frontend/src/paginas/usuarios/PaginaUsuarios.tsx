import { useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, UserRoundCheckIcon, UserRoundXIcon } from 'lucide-react'
import { PAPEIS, ROTULOS_PAPEL, type Papel } from '@vulncase/compartilhado'
import { mensagemDeErro } from '@/api/cliente'
import { useAlterarUsuario, useUsuarios, type UsuarioLista } from '@/api/usuarios'
import { useUsuario } from '@/auth/sessao'
import { CabecalhoPagina } from '@/componentes/cabecalho'
import { DialogoConfirmacao } from '@/componentes/dialogo'
import { Carregando, MensagemErro, Vazio } from '@/componentes/estado'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/componentes/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/componentes/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/componentes/ui/table'
import { cn } from '@/lib/utils'
import { FormularioNovoUsuario } from './FormularioNovoUsuario'

/** Papel editável na própria linha; a troca encerra as sessões do usuário. */
function SeletorPapel({ usuario, desabilitado }: { usuario: UsuarioLista; desabilitado: boolean }) {
  const alterar = useAlterarUsuario()
  return (
    <Select
      value={usuario.papel}
      disabled={desabilitado || alterar.isPending}
      onValueChange={(papel) =>
        alterar.mutate(
          { id: usuario.id, dados: { papel: papel as Papel } },
          {
            onSuccess: (u) => toast.success(`${u.nome} agora é ${ROTULOS_PAPEL[u.papel]}`),
            onError: (err) => toast.error(mensagemDeErro(err)),
          },
        )
      }
    >
      <SelectTrigger size="sm" aria-label={`Papel de ${usuario.nome}`} className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAPEIS.map((p) => (
          <SelectItem key={p} value={p}>
            {ROTULOS_PAPEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PaginaUsuarios() {
  const eu = useUsuario()
  const usuarios = useUsuarios()
  const alterar = useAlterarUsuario()
  const [criando, setCriando] = useState(false)
  const [alvo, setAlvo] = useState<UsuarioLista | null>(null)

  function confirmarSituacao() {
    if (!alvo) return
    alterar.mutate(
      { id: alvo.id, dados: { ativo: !alvo.ativo } },
      {
        onSuccess: (u) => {
          toast.success(`${u.nome} ${u.ativo ? 'reativado' : 'desativado'}`)
          setAlvo(null)
        },
      },
    )
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Contas, papéis e acesso à ferramenta."
        acoes={
          <Button onClick={() => setCriando(true)}>
            <PlusIcon />
            Novo usuário
          </Button>
        }
      />

      {usuarios.isPending ? (
        <Carregando />
      ) : usuarios.isError ? (
        <MensagemErro erro={usuarios.error} />
      ) : usuarios.data.length === 0 ? (
        <Vazio titulo="Nenhum usuário cadastrado" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-4 text-right">Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.data.map((u) => {
                const proprio = u.id === eu.id
                return (
                  <TableRow
                    key={u.id}
                    data-email={u.email}
                    className={cn(!u.ativo && 'text-muted-foreground')}
                  >
                    <TableCell className="pl-4 font-medium">
                      {u.nome}
                      {proprio && (
                        <span className="ml-1.5 font-normal text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <SeletorPapel
                        key={`${u.id}-${u.papel}`}
                        usuario={u}
                        desabilitado={proprio || !u.ativo}
                      />
                    </TableCell>
                    <TableCell>
                      {u.ativo ? (
                        <Badge variant="outline" className="text-st-encerrado">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {!proprio && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(u.ativo && 'text-destructive hover:text-destructive')}
                          onClick={() => {
                            alterar.reset()
                            setAlvo(u)
                          }}
                        >
                          {u.ativo ? <UserRoundXIcon /> : <UserRoundCheckIcon />}
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              A pessoa entra com o e-mail e a senha inicial definidos aqui.
            </DialogDescription>
          </DialogHeader>
          {criando && (
            <FormularioNovoUsuario
              aoCancelar={() => setCriando(false)}
              aoCriar={(nome) => {
                setCriando(false)
                toast.success(`Usuário ${nome} cadastrado`)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogoConfirmacao
        aberto={alvo !== null}
        titulo={alvo?.ativo ? `Desativar ${alvo.nome}?` : `Reativar ${alvo?.nome ?? ''}?`}
        mensagem={
          alvo?.ativo ? (
            <>
              A pessoa perde o acesso na hora. Os achados abertos atribuídos a ela ficam sem
              responsável, e os que estavam em correção voltam para Aberto.
            </>
          ) : (
            <>A pessoa volta a poder entrar com a senha atual.</>
          )
        }
        rotuloConfirmar={alvo?.ativo ? 'Desativar usuário' : 'Reativar usuário'}
        perigo={alvo?.ativo ?? false}
        ocupado={alterar.isPending}
        erro={alterar.isError ? mensagemDeErro(alterar.error) : null}
        aoConfirmar={confirmarSituacao}
        aoCancelar={() => setAlvo(null)}
      />
    </>
  )
}
