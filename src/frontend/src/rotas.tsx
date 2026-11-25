import { createBrowserRouter } from 'react-router'
import { RotaPapel, RotaProtegida } from './auth/rotas-protegidas'
import { Layout } from './componentes/layout'
import { PaginaConta } from './paginas/conta/PaginaConta'
import { PaginaEntrar } from './paginas/entrar/PaginaEntrar'
import { PaginaNaoEncontrada } from './paginas/erro/PaginaNaoEncontrada'
import { PaginaPainel } from './paginas/painel/PaginaPainel'
import { PaginaUsuarios } from './paginas/usuarios/PaginaUsuarios'

export const roteador = createBrowserRouter([
  { path: '/entrar', element: <PaginaEntrar /> },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <PaginaPainel /> },
          { path: 'conta', element: <PaginaConta /> },
          {
            element: <RotaPapel papeis={['Administrador']} />,
            children: [{ path: 'usuarios', element: <PaginaUsuarios /> }],
          },
          { path: '*', element: <PaginaNaoEncontrada /> },
        ],
      },
    ],
  },
])
