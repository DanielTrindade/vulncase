import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  ChevronsUpDownIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  LogOutIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROTULOS_PAPEL, type Papel } from '@vulncase/compartilhado'
import { useSessao, useUsuario } from '@/auth/sessao'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Marca } from './marca'

interface ItemMenu {
  para: string
  rotulo: string
  icone: LucideIcon
  papeis?: Papel[]
}

const MENU: ItemMenu[] = [
  { para: '/', rotulo: 'Painel', icone: LayoutDashboardIcon },
  { para: '/achados', rotulo: 'Achados', icone: ListChecksIcon },
  { para: '/projetos', rotulo: 'Projetos', icone: FolderKanbanIcon },
  { para: '/usuarios', rotulo: 'Usuários', icone: UsersIcon, papeis: ['Administrador'] },
]

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return (
    (partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')
  ).toUpperCase()
}

/** Menu da conta: troca de senha e saída. */
function MenuConta() {
  const usuario = useUsuario()
  const { sair } = useSessao()
  const navegar = useNavigate()

  async function aoSair() {
    await sair().catch(() => undefined)
    navegar('/entrar', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu da conta"
        className="pressionavel flex w-full items-center gap-3 rounded-md p-2 text-left outline-none hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-foreground/5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {iniciais(usuario.nome)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium" data-testid="conta-nome">
            {usuario.nome}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {ROTULOS_PAPEL[usuario.papel]}
          </span>
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{usuario.nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{usuario.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navegar('/conta')}>
          <UserRoundIcon />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void aoSair()}>
          <LogOutIcon />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Layout() {
  const { temPapel } = useSessao()
  const itens = MENU.filter((i) => !i.papeis || temPapel(...i.papeis))

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      {/* O invólucro estica com a página (fundo e borda contínuos); a lateral fixa-se nele. */}
      <div className="sticky top-0 z-20 md:static md:border-r md:bg-sidebar">
        <aside className="flex flex-col border-b bg-sidebar md:sticky md:top-0 md:h-dvh md:border-b-0">
          <div className="flex h-14 items-center px-4 md:h-16 md:px-5">
            <NavLink
              to="/"
              className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Marca />
            </NavLink>
          </div>
          <nav
            aria-label="Navegação principal"
            className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-1 md:flex-col md:pb-0"
          >
            {itens.map(({ para, rotulo, icone: Icone }) => (
              <NavLink
                key={para}
                to={para}
                end={para === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150',
                    'hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive && 'bg-card text-foreground shadow-[inset_0_0_0_1px_var(--border)]',
                  )
                }
              >
                <Icone className="size-4" />
                {rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="hidden border-t p-3 md:block">
            <MenuConta />
          </div>
        </aside>
      </div>
      <div className="min-w-0">
        {/* Em telas estreitas o menu da conta fica no topo do conteúdo. */}
        <div className="border-b p-2 md:hidden">
          <MenuConta />
        </div>
        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
