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

## Pilha prevista

- Back-end: ASP.NET Core Web API (.NET 10 LTS), Entity Framework Core, PostgreSQL
- Front-end: React com TypeScript e Vite
- Ambiente: Docker Compose

## Estrutura do repositório

```
vulncase/
├── docs/            documentação do projeto
├── src/
│   ├── backend/     API ASP.NET Core
│   └── frontend/    aplicação React
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
