import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/seed-cli.ts', 'src/db/migrar-cli.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // O pacote compartilhado é publicado como código-fonte TypeScript e precisa ser embutido.
  noExternal: [/^@vulncase\//],
})
