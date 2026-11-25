# 07 — Execução dos critérios de aceite do MVP

Execução do roteiro da [seção 10 do documento 01](01-visao-e-escopo.md#10-critérios-de-aceite-do-mvp) em ambiente subido do zero, sem nenhuma intervenção no banco de dados.

| Item | Valor |
|---|---|
| Data | 25/11/2026 |
| Ambiente | `docker compose down -v && docker compose up` (PostgreSQL 17, API, front-end e Caddy), acesso por `https://localhost` |
| Configuração | `.env` copiado do exemplo, `NODE_ENV=production`, administrador inicial por `ADMIN_EMAIL_INICIAL`/`ADMIN_SENHA_INICIAL` |
| Execução | Interface operada pelo Playwright com o script [`scripts/roteiro-aceite.cjs`](../scripts/roteiro-aceite.cjs) (`pnpm aceite`) |
| Resultado | **8 de 8 passos aprovados**; nenhuma falha encontrada, portanto nenhuma issue aberta |

## Resultado por passo

A Tabela 1 apresenta o resultado de cada passo do roteiro, com a evidência correspondente.

**Tabela 1 — Resultado dos critérios de aceite**

| # | Critério | Resultado | Evidência |
|:-:|---|:-:|---|
| 1 | O administrador entra no sistema e cadastra um analista e um desenvolvedor. | Aprovado | Ana Analista e Davi Desenvolvedor cadastrados pela tela de usuários. [Captura](aceite/01-usuarios-cadastrados.jpg) |
| 2 | O analista cria um projeto e registra cinco achados de origens diferentes, com severidade, categoria OWASP, CWE e correção proposta. | Aprovado | Projeto `LAB` e achados `LAB-0001` a `LAB-0005` (2 de análise de rede, 2 de teste de aplicação web, 1 de revisão de código). [Captura](aceite/02-cinco-achados-registrados.jpg) |
| 3 | O analista atribui dois achados ao desenvolvedor e os move para "Em correção". | Aprovado | `LAB-0001` e `LAB-0003` atribuídos a Davi e em correção. [Captura](aceite/03-dois-em-correcao.jpg) |
| 4 | O desenvolvedor entra, vê apenas as ações permitidas ao seu papel e move um achado para "Aguardando verificação". | Aprovado | Menu sem "Usuários"; nenhuma ação em achado não atribuído; apenas "Concluir correção" no próprio. `LAB-0001` movido com justificativa. [Ações](aceite/04a-desenvolvedor-acoes-permitidas.jpg), [resultado](aceite/04b-aguardando-verificacao.jpg) |
| 5 | O analista verifica a correção e encerra o achado como "Corrigido"; outro achado é marcado como "Falso positivo" com justificativa. | Aprovado | `LAB-0001` Corrigido; `LAB-0002` Falso positivo. [Captura](aceite/05-falso-positivo.jpg) |
| 6 | O painel do projeto mostra as contagens corretas por severidade e status. | Aprovado | Total 5, abertos 3, sem responsável 2, vencidos 0. Severidade: Crítica 1, Alta 1, Média 2, Baixa 1, Informativa 0. Status: Aberto 2, Em correção 1, Aguardando verificação 0, Corrigido 1, Falso positivo 1, Risco aceito 0 — iguais à contagem manual. [Captura](aceite/06-painel-do-projeto.jpg) |
| 7 | O histórico do achado encerrado mostra todas as transições, com usuário e data. | Aprovado | `LAB-0001`: registro, atribuição, Aberto → Em correção (Ana), Em correção → Aguardando verificação (Davi, com justificativa), Aguardando verificação → Corrigido (Ana), todos com data e hora. [Captura](aceite/07-historico-do-encerrado.jpg) |
| 8 | Uma tentativa do desenvolvedor de executar uma ação reservada ao analista, feita diretamente na API, retorna HTTP 403. | Aprovado | `POST /api/achados/{id}/transicoes` com destino `FalsoPositivo` → 403 "Seu papel não permite executar esta transição."; `POST /api/projetos` → 403. |

## Como repetir

```bash
docker compose down -v
docker compose up -d --build
pnpm exec playwright install chromium   # apenas na primeira vez
pnpm aceite
```

O certificado do Caddy é de uma autoridade local; o script ignora o aviso de certificado apenas para esta execução.
