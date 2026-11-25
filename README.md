# VulnCase

Ferramenta web para registro, priorização e acompanhamento de achados de segurança. Projeto Integrador da disciplina ICC330 — Fundamentos de Cibersegurança e Desenvolvimento Seguro (UFAM), Trilha 3.

## Objetivo

O VulnCase centraliza os achados de segurança de um projeto em um único fluxo: registro do achado, classificação de severidade, atribuição de responsável, anexação de evidências, acompanhamento do status da correção e consolidação dos resultados em painel e relatório.

## Documentação

| Documento | Conteúdo |
|---|---|
| [01 — Visão e escopo](docs/01-visao-e-escopo.md) | Problema, objetivo, escopo do MVP, itens fora do escopo, limites e critérios de aceite |
| [02 — Requisitos](docs/02-requisitos.md) | Papéis, requisitos funcionais, requisitos não funcionais e regras de negócio |
| [03 — Modelagem](docs/03-modelagem.md) | Casos de uso, modelo de domínio, modelo de dados, dicionário de dados, máquina de estados e sequências |
| [04 — Arquitetura e API](docs/04-arquitetura.md) | Pilha tecnológica, organização do código, contrato da API REST e decisões técnicas |
| [05 — Modelo de ameaças](docs/05-modelo-de-ameacas.md) | Análise STRIDE da própria ferramenta e controles adotados |
| [06 — Plano de entregas](docs/06-plano-de-entregas.md) | Entregas incrementais, backlog por entrega e roteiro de demonstração |
| [07 — Critérios de aceite](docs/07-criterios-de-aceite.md) | Execução do roteiro de aceite do MVP, com capturas de tela |
| [08 — Verificação de segurança](docs/08-verificacao-de-seguranca.md) | Testes de segurança da própria ferramenta, OWASP ZAP, dependências e segredos |

## Como executar

Pré-requisitos: Docker com o plugin Compose. Para desenvolvimento fora do Docker, Node.js 24 LTS (ver `.nvmrc`) e pnpm 10 (`corepack enable`).

### Ambiente completo (Docker Compose)

```bash
cp .env.example .env   # preencha POSTGRES_PASSWORD, ADMIN_EMAIL_INICIAL e ADMIN_SENHA_INICIAL
docker compose up --build
```

- Front-end: <https://localhost>
- API: <https://localhost/api/health>

O Caddy emite um certificado de uma autoridade local; o navegador exibirá um aviso na primeira visita. Para confiar na autoridade, execute `docker compose exec proxy caddy trust` ou importe `/data/caddy/pki/authorities/local/root.crt` do contêiner `proxy`.

Serviços: `db` (PostgreSQL 17), `api` (Hono), `web` (arquivos estáticos do React) e `proxy` (Caddy, único serviço com portas publicadas). O volume `evidencias` é montado apenas na API e não é servido pelo proxy.

### Dados de demonstração

A carga cria um usuário de cada papel e os projetos `REDE`, `WEB` e `COD`, com achados em todos os status e severidades e histórico coerente (documento 06, seção 3). Ela só roda com `NODE_ENV=development` e não repete a carga se os projetos já existirem.

```bash
# no .env: NODE_ENV=development
docker compose exec api node dist/db/seed-cli.js
```

Fora do Docker: `pnpm --filter @vulncase/backend db:seed`.

| E-mail | Papel |
|---|---|
| `admin@demo.vulncase.local` | Administrador |
| `analista@demo.vulncase.local` | Analista |
| `dev@demo.vulncase.local` | Desenvolvedor |

A senha é a da variável `DEMO_SENHA`; sem ela, `demo-vulncase-2026`. Use apenas em ambiente local.

### Desenvolvimento

Fora do Docker, a API precisa de um PostgreSQL acessível e das variáveis `DATABASE_URL` e `ORIGEM_PERMITIDA=http://localhost:5173` (a origem do Vite). As *migrations* são aplicadas na subida.

```bash
pnpm install
pnpm dev         # API em :3000 e Vite em :5173 (com proxy de /api)
```

### Qualidade e testes

```bash
pnpm lint          # ESLint (inclui eslint-plugin-security)
pnpm format:check  # Prettier
pnpm typecheck     # TypeScript estrito nos três pacotes
pnpm test          # Vitest; os testes de integração sobem um PostgreSQL 17 com Testcontainers (requer Docker)
pnpm audit
```

O teste do back-end gera relatório de cobertura e exige 100% em `src/dominio`. Com o ambiente Docker no ar, dois roteiros pelo navegador (Playwright) reproduzem os documentos 07 e 08:

```bash
pnpm aceite                 # critérios de aceite do MVP, com capturas em docs/aceite
pnpm verificacao            # testes de segurança da seção 5 do documento 05
pnpm verificacao:registrar  # registra os resultados como achados do projeto VulnCase
```

## Pilha

- Back-end: Hono sobre Node.js 24 LTS, TypeScript, Drizzle ORM, PostgreSQL 17, Argon2id, pino, pdfkit
- Front-end: React com TypeScript, Vite, TanStack Query, React Hook Form e Recharts
- Validação: esquemas Zod compartilhados entre front-end e back-end
- Testes: Vitest, Testcontainers e Playwright
- Organização: monorepositório com *workspaces* do pnpm
- Ambiente: Docker Compose com Caddy (HTTPS local)

## Convenções

- *Branches*: `tipo/numero-da-issue-descricao`, por exemplo `feat/29-api-evidencias` ou `docs/37-revisao-documentacao`.
- *Commits*: [Conventional Commits](https://www.conventionalcommits.org/) em português (`feat`, `fix`, `test`, `docs`, `build`, `ci`, `chore`), com `Closes #N` para fechar a issue.

## Estrutura do repositório

```
vulncase/
├── docs/            documentação do projeto, evidências de aceite e de verificação
├── scripts/         roteiros de aceite e de verificação de segurança (Playwright)
├── docker/          configuração do Caddy que serve o front-end
├── src/
│   ├── backend/        API Hono
│   ├── frontend/       aplicação React
│   └── compartilhado/  esquemas Zod e tipos usados pelos dois lados
└── README.md
```

## Equipe

| Integrante | Matrícula | Papel principal |
|---|---|---|
| Daniel Trindade | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] |

Professor: Eduardo Feitosa.
