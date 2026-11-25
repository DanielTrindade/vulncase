import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/apoio/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['test/**', 'src/index.ts', 'src/db/migrar-cli.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        // Critério da issue #16: 100% dos ramos no domínio.
        'src/dominio/**': { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
})
