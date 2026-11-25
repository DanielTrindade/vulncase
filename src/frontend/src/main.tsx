import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ErroApi } from './api/cliente'
import { ProvedorSessao } from './auth/sessao'
import { roteador } from './rotas'
import './estilos.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não repete erros de cliente (4xx): só falhas de rede ou 5xx.
      retry: (tentativas, erro) =>
        !(erro instanceof ErroApi && erro.status < 500) && tentativas < 2,
      refetchOnWindowFocus: false,
    },
  },
})

const raiz = document.getElementById('root')
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ProvedorSessao>
          <RouterProvider router={roteador} />
        </ProvedorSessao>
      </QueryClientProvider>
    </StrictMode>,
  )
}
