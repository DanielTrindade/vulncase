import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'src/backend/drizzle/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Acesso a objetos por chave tipada é seguro com TypeScript estrito; gera muitos falsos positivos.
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['src/backend/src/**/*.ts'],
    rules: {
      // RNF08: proíbe SQL montado como texto.
      'no-restricted-properties': [
        'error',
        { object: 'sql', property: 'raw', message: 'sql.raw é proibido (RNF08).' },
      ],
    },
  },
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // RNF09: conteúdo cadastrado é sempre exibido como texto.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML é proibido (RNF09).',
        },
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'innerHTML é proibido (RNF09).',
        },
      ],
    },
  },
  prettier,
)
