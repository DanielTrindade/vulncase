import { createBrowserRouter } from 'react-router'
import { RotaPapel, RotaProtegida } from './auth/rotas-protegidas'
import { Layout } from './componentes/layout'
import { PaginaAchados } from './paginas/achados/PaginaAchados'
import { PaginaEditarAchado } from './paginas/achados/PaginaEditarAchado'
import { PaginaNovoAchado } from './paginas/achados/PaginaNovoAchado'
import { PaginaConta } from './paginas/conta/PaginaConta'
import { PaginaEntrar } from './paginas/entrar/PaginaEntrar'
import { PaginaNaoEncontrada } from './paginas/erro/PaginaNaoEncontrada'
import { PaginaPainel } from './paginas/painel/PaginaPainel'
import { PaginaFormularioProjeto } from './paginas/projetos/PaginaFormularioProjeto'
import { PaginaProjeto } from './paginas/projetos/PaginaProjeto'
import { PaginaProjetos } from './paginas/projetos/PaginaProjetos'
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
          { path: 'achados', element: <PaginaAchados /> },
          { path: 'projetos', element: <PaginaProjetos /> },
          { path: 'projetos/:id', element: <PaginaProjeto /> },
          {
            element: <RotaPapel papeis={['Analista', 'Administrador']} />,
            children: [
              { path: 'projetos/novo', element: <PaginaFormularioProjeto /> },
              { path: 'projetos/:id/editar', element: <PaginaFormularioProjeto /> },
              { path: 'projetos/:id/achados/novo', element: <PaginaNovoAchado /> },
              { path: 'achados/:id/editar', element: <PaginaEditarAchado /> },
            ],
          },
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
