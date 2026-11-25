import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * Duas dependências injetam <style> em tempo de execução, o que a CSP da aplicação
 * (style-src 'self', sem 'unsafe-inline') bloqueia. Este plugin remove as injeções; o
 * CSS equivalente é servido no bundle:
 * - Sonner: o CSS vem de 'sonner/dist/styles.css' (componentes/ui/sonner.tsx);
 * - Radix Select: a regra que esconde a barra de rolagem do viewport está em estilos.css.
 */
const INJECOES: { modulo: RegExp; trecho: RegExp; nome: string }[] = [
  {
    nome: 'sonner',
    modulo: /[\\/]sonner[\\/]dist[\\/]index\.m?js$/,
    trecho: /^__insertCSS\(.*\);?$/m,
  },
  {
    nome: '@radix-ui/react-select',
    modulo: /[\\/]@radix-ui[\\/]react-select[\\/]dist[\\/]index\.mjs$/,
    trecho:
      /\/\* @__PURE__ \*\/ jsx\(\s*"style",\s*\{\s*dangerouslySetInnerHTML:[\s\S]*?nonce\s*\}\s*\)/,
  },
]

function semEstiloInline(): Plugin {
  return {
    name: 'sem-estilo-inline',
    enforce: 'pre',
    transform(codigo, id) {
      const alvo = INJECOES.find((i) => i.modulo.test(id))
      if (!alvo) return null
      const novo = codigo.replace(alvo.trecho, 'null')
      if (novo === codigo)
        throw new Error(`${alvo.nome}: injeção de <style> não encontrada; revise o plugin`)
      return { code: novo, map: null }
    },
  }
}

export default defineConfig({
  plugins: [semEstiloInline(), react(), tailwindcss()],
  optimizeDeps: {
    // Garante que o plugin acima também se aplique no servidor de desenvolvimento.
    exclude: ['sonner', 'radix-ui', '@radix-ui/react-select'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // Ver src/lib/sem-estilo-inline.ts (CSP sem 'unsafe-inline').
      'react-style-singleton': path.resolve(import.meta.dirname, './src/lib/sem-estilo-inline.ts'),
    },
  },
  server: {
    // Em desenvolvimento a API roda em http://localhost:3000; o proxy mantém a mesma origem.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
  },
})
