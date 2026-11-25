import { createBrowserRouter } from 'react-router'
import { RotaProtegida } from './auth/rotas-protegidas'
import { Layout } from './componentes/layout'
import { PaginaEntrar } from './paginas/entrar/PaginaEntrar'
import { PaginaNaoEncontrada } from './paginas/erro/PaginaNaoEncontrada'
import { PaginaPainel } from './paginas/painel/PaginaPainel'

export const roteador = createBrowserRouter([
  { path: '/entrar', element: <PaginaEntrar /> },
  {
    element: <RotaProtegida />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <PaginaPainel /> },
          { path: '*', element: <PaginaNaoEncontrada /> },
        ],
      },
    ],
  },
])
