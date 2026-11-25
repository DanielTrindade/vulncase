import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ROTULOS_PAPEL } from '@vulncase/compartilhado'

function App() {
  return <h1>VulnCase — {Object.values(ROTULOS_PAPEL).join(', ')}</h1>
}

const raiz = document.getElementById('root')
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
