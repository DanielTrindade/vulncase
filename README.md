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

### Desenvolvimento

```bash
pnpm install
pnpm dev         # API em :3000 e Vite em :5173 (com proxy de /api)
pnpm lint
pnpm typecheck
pnpm test
```

## Pilha prevista

- Back-end: Hono sobre Node.js 24 LTS, TypeScript, Drizzle ORM, PostgreSQL
- Front-end: React com TypeScript e Vite
- Organização: monorepositório com *workspaces* do pnpm
- Ambiente: Docker Compose

## Estrutura do repositório

```
vulncase/
├── docs/            documentação do projeto
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
