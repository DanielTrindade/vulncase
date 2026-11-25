import { NavLink, Outlet, useNavigate } from 'react-router'
import { ROTULOS_PAPEL, type Papel } from '@vulncase/compartilhado'
import { useSessao, useUsuario } from '../auth/sessao'

interface ItemMenu {
  para: string
  rotulo: string
  papeis?: Papel[]
}

const MENU: ItemMenu[] = [
  { para: '/', rotulo: 'Painel' },
  { para: '/projetos', rotulo: 'Projetos' },
  { para: '/achados', rotulo: 'Achados' },
  { para: '/usuarios', rotulo: 'Usuários', papeis: ['Administrador'] },
]

export function Layout() {
  const usuario = useUsuario()
  const { sair, temPapel } = useSessao()
  const navegar = useNavigate()

  async function aoSair() {
    await sair().catch(() => undefined)
    navegar('/entrar', { replace: true })
  }

  return (
    <div className="app">
      <header className="topo">
        <NavLink to="/" className="marca">
          <span className="marca__simbolo" aria-hidden="true">
            ◆
          </span>
          VulnCase
        </NavLink>
        <nav className="menu" aria-label="Navegação principal">
          {MENU.filter((i) => !i.papeis || temPapel(...i.papeis)).map((item) => (
            <NavLink key={item.para} to={item.para} end={item.para === '/'} className="menu__item">
              {item.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="conta">
          <NavLink to="/conta" className="conta__nome" title="Minha conta">
            {usuario.nome}
            <span className="conta__papel">{ROTULOS_PAPEL[usuario.papel]}</span>
          </NavLink>
          <button type="button" className="botao botao--discreto" onClick={() => void aoSair()}>
            Sair
          </button>
        </div>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
