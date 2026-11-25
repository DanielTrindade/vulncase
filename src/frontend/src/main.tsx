import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { z } from 'zod'
// Fontes servidas pela própria aplicação (CSP font-src 'self').
import '@fontsource-variable/public-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { ErroApi } from './api/cliente'
import { ProvedorSessao } from './auth/sessao'
import { Toaster } from './componentes/ui/sonner'
import { TooltipProvider } from './componentes/ui/tooltip'
import { roteador } from './rotas'
import './estilos.css'

// O Zod testa `new Function` para compilar validadores, o que a CSP (script-src 'self',
// sem 'unsafe-eval') bloqueia e registra como violação. Sem JIT a validação é a mesma.
z.config({ jitless: true })

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
          {/* Primeiro tooltip espera 400ms; os seguintes abrem na hora (Emil Kowalski). */}
          <TooltipProvider delayDuration={400} skipDelayDuration={300}>
            <RouterProvider router={roteador} />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ProvedorSessao>
      </QueryClientProvider>
    </StrictMode>,
  )
}
