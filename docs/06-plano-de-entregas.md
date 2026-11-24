# 06 — Plano de entregas

As datas dependem do calendário da disciplina [PREENCHER: datas das entregas parciais e da apresentação final]. Cada entrega termina com o sistema executável via `docker compose up` e com a demonstração das funcionalidades da entrega.

## 1. Entregas

### Entrega 1 — Fundação

Objetivo: ambiente executável, autenticação e projetos.

- [ ] Repositório, monorepositório pnpm, `.gitignore`, `.env.example` e convenção de *branches*
- [ ] Docker Compose com PostgreSQL, API, front-end e *proxy*
- [ ] Esquema Drizzle e primeira *migration*
- [ ] Autenticação: Argon2id, tabela de sessões, *cookie*, bloqueio por tentativas e *middleware* `csrf` (RF01, RF02, RNF01 a RNF05)
- [ ] Cabeçalhos de segurança e tratamento de erros (RNF10, RNF11)
- [ ] Criação do administrador inicial e gestão de usuários (RF03 a RF05)
- [ ] CRUD de projetos com arquivamento (RF07 a RF10)
- [ ] Telas: entrar, lista de projetos, formulário de projeto, usuários

### Entrega 2 — Achados

Objetivo: ciclo de vida completo do achado.

- [ ] Entidade `Achado` com geração de código (RF12, RF13, RN02)
- [ ] Catálogo OWASP e campo CWE (RF14)
- [ ] Atribuição de responsável (RF15)
- [ ] Máquina de estados e testes de todas as combinações da Tabela 7 do documento 03 (RF16, RF17, RNF20)
- [ ] Histórico de eventos (RF20)
- [ ] Listagem com filtros e paginação (RF18)
- [ ] Telas: lista de achados, formulário, detalhe, diálogo de transição, histórico

### Entrega 3 — Consolidação

Objetivo: painéis e fechamento do MVP.

- [ ] Painel por projeto e painel geral (RF27, RF28)
- [ ] Testes de integração de autorização por rota (RNF20)
- [ ] Carga de dados de demonstração (RNF19)
- [ ] Execução dos critérios de aceite do documento 01, seção 10

### Entrega final — Itens desejáveis e verificação

Ordem de prioridade dos itens desejáveis, do mais ao menos relevante para a demonstração:

1. [ ] Evidências com envio seguro (RF25, RF26, RNF14, RNF15)
2. [ ] Exportação CSV (RF29)
3. [ ] Prazo por severidade e indicador de vencidos (RF24, RN10)
4. [ ] Comentários (RF21)
5. [ ] Ativos (RF11, RF22)
6. [ ] Relatório PDF (RF30)

Verificação de segurança:

- [ ] Testes da seção 5 do documento 05 registrados como achados
- [ ] `pnpm audit` e `gitleaks` sem pendências críticas
- [ ] Apresentação e vídeo de demonstração

## 2. Divisão sugerida do trabalho

| Frente | Responsável |
|---|---|
| Domínio, máquina de estados e testes | [PREENCHER] |
| API, autenticação e autorização | [PREENCHER] |
| Front-end | [PREENCHER] |
| Infraestrutura, dados de demonstração, modelo de ameaças e documentação | [PREENCHER] |

## 3. Dados de demonstração

A carga de demonstração cria três usuários (um de cada papel) e três projetos. Os achados vêm de ambientes de laboratório, o que conecta a ferramenta às três disciplinas do módulo.

| Projeto | Prefixo | Origem dos achados | Exemplos |
|---|---|---|---|
| Laboratório de redes | `REDE` | Atividades de análise de tráfego e varredura da disciplina | Telnet com credenciais em texto claro (CWE-319); HTTP sem TLS em formulário de autenticação; serviço de banco exposto na rede |
| Aplicação web de teste | `WEB` | Aplicação deliberadamente vulnerável, como OWASP Juice Shop ou DVWA, executada localmente | SQL Injection no *login* (CWE-89); XSS refletido na busca (CWE-79); acesso a rota administrativa sem autorização (CWE-862) |
| Revisão de código | `COD` | Trechos de código revisados pela equipe | Segredo *hardcoded* (CWE-798); senha armazenada sem *hash* (CWE-256); validação de entrada ausente (CWE-20) |

Os achados de demonstração devem cobrir todos os status e todas as severidades, para que o painel mostre todos os indicadores.

## 4. Roteiro da apresentação

1. Problema e escopo (documento 01) — 2 min
2. Modelagem: domínio e máquina de estados (documento 03) — 3 min
3. Demonstração do fluxo dos critérios de aceite — 6 min
4. Controles de segurança da própria ferramenta e resultados da verificação (documento 05) — 3 min
5. Limitações e evolução possível — 1 min
