# 04 — Arquitetura e API

## 1. Visão geral

O VulnCase é uma aplicação web em três partes: front-end React, API Hono e banco PostgreSQL. Um *proxy* reverso serve o front-end e a API na mesma origem. Com isso, a autenticação por *cookie* funciona com `SameSite=Strict` e não há configuração de CORS.

A Figura 1 apresenta os contêineres da solução.

```mermaid
flowchart LR
    B[Navegador] -->|HTTPS| P[Proxy reverso<br/>Caddy]
    P -->|/| F[Front-end<br/>arquivos estáticos React]
    P -->|/api| A[API<br/>Hono sobre Node.js]
    A -->|Drizzle ORM / pg| D[(PostgreSQL)]
    A -->|leitura e escrita| E[/Volume de evidências/]
```

*Figura 1 — Diagrama de contêineres.*

## 2. Pilha tecnológica

**Tabela 1 — Tecnologias adotadas**

| Camada | Tecnologia | Uso no projeto |
|---|---|---|
| Linguagem | TypeScript em modo estrito | Front-end, back-end e esquemas compartilhados. |
| *Runtime* | Node.js 24 LTS com `@hono/node-server` | Execução da API. |
| *Framework* HTTP | Hono | Rotas, *middlewares* e cliente RPC tipado. |
| *Middlewares* de segurança | `secureHeaders` e `bodyLimit`, nativos do Hono, e `verificarOrigem`, próprio | RNF10, RNF05 e RNF14. O `csrf` nativo do Hono só verifica corpos de formulário e deixa passar JSON; por isso a verificação de origem é feita por um *middleware* próprio que vale para qualquer tipo de conteúdo. |
| Validação | Zod com `@hono/zod-validator` | Validação de corpo, parâmetros e consulta (RNF07). |
| Persistência | Drizzle ORM com o *driver* `pg` | Consultas tipadas e parametrizadas (RNF08). |
| *Migrations* | `drizzle-kit` | Criação e evolução do esquema (RNF18). |
| *Hash* de senha | Argon2id com `@node-rs/argon2` | RNF01. |
| Sessão | Implementação própria com tabela `sessoes` | RNF04; detalhada na Tabela 4 do documento 03. |
| *Log* | `pino` | *Log* estruturado de autenticação e administração (RNF13). |
| Banco | PostgreSQL 17 | Bloqueio de linha para o contador de códigos. |
| Front-end | React + Vite | Interface. |
| Requisições no front-end | Cliente `hc` do Hono + TanStack Query | Chamadas tipadas a partir das rotas; *cache* e invalidação das listagens. |
| Formulários | React Hook Form + esquemas Zod compartilhados | Validação no cliente para usabilidade; a validação de segurança permanece no back-end. |
| Componentes de interface | shadcn/ui (Radix UI) com Tailwind CSS v4 | Sistema de design comum, acessível por teclado e leitor de tela, customizado conforme o [documento 09](09-design-da-interface.md). Funciona sob a CSP sem `'unsafe-inline'`: as injeções de `<style>` do Sonner e do Radix Select são removidas no *build* e o CSS equivalente é servido no pacote. |
| Painel | Componentes próprios | Faixa de severidade, etapas do ciclo e pendências, todos levando à lista filtrada. |
| Relatório PDF | `pdfkit` com fonte DejaVu embutida | Documento desenhado por código, sem interpretar HTML (RF30). |
| Testes | Vitest, Testcontainers (PostgreSQL) e Playwright | Testes de domínio sem banco, testes de integração com banco real e roteiros de aceite e de segurança pelo navegador. |
| Qualidade | ESLint com `eslint-plugin-security`, Prettier, `pnpm audit` e `gitleaks` | Regras contra padrões inseguros (`eval`, `sql.raw`, `dangerouslySetInnerHTML`), formatação e verificação de dependências e segredos no CI. |
| Monorepositório | *Workspaces* do pnpm | Pacotes `backend`, `frontend` e `compartilhado`. |
| Ambiente | Docker Compose e Caddy | Subida com um comando (RNF17) e HTTPS local. |

## 3. Organização do código

O repositório é um monorepositório com três pacotes. O pacote `compartilhado` contém os esquemas Zod e os tipos do domínio usados pelos dois lados. O front-end importa do back-end apenas o tipo `AppType`, que descreve as rotas para o cliente `hc`.

```
vulncase/
├── pnpm-workspace.yaml
├── docker-compose.yml, Dockerfile
├── Caddyfile                      proxy reverso (HTTPS local)
├── docker/Caddyfile.web           arquivos estáticos do front-end
├── scripts/                       roteiro de aceite e verificação de segurança (Playwright)
└── src/
    ├── compartilhado/
    │   └── src/
    │       ├── enums.ts               Severidade, StatusAchado, Papel e rótulos
    │       └── esquemas/              esquemas Zod de entrada (usuário, projeto, achado)
    ├── backend/
    │   ├── src/
    │   │   ├── index.ts               inicialização: configuração, migrations, admin inicial
    │   │   ├── app.ts                 ordem dos middlewares e montagem das rotas; exporta AppType
    │   │   ├── config.ts              variáveis de ambiente validadas com Zod
    │   │   ├── dominio/               funções puras, sem banco e sem HTTP
    │   │   │   ├── achado.ts          transicionar(), atribuirResponsavel(), acoesPermitidas(), estaVencido()
    │   │   │   ├── regras-transicao.ts  Tabela 7 do documento 03
    │   │   │   ├── prazo.ts           data-limite por severidade (RN10)
    │   │   │   ├── projeto.ts         gerarCodigoAchado()
    │   │   │   └── erros.ts           erros com código HTTP e título público
    │   │   ├── db/                    schema.ts, cliente.ts, migrar.ts, admin-inicial.ts, seed.ts
    │   │   ├── middlewares/           requisicao, seguranca, sessao, autorizacao, validacao, erros
    │   │   ├── servicos/              casos de uso: carregam, chamam o domínio e persistem
    │   │   ├── rotas/                 auth, usuarios, projetos, achados, evidencias, painel, categorias
    │   │   └── infra/                 senha (Argon2id), token, log, armazenamento, tipos-arquivo, csv
    │   ├── drizzle/                   migrations geradas (e migrations SQL próprias)
    │   └── test/
    │       ├── dominio/               transições e regras de negócio (100% de cobertura)
    │       ├── unidade/               configuração, senha, CSV, tipos de arquivo
    │       └── integracao/            rotas HTTP com PostgreSQL real, incluindo a matriz de autorização
    └── frontend/
        ├── src/
        │   ├── api/                   cliente hc e hooks do TanStack Query
        │   ├── auth/                  contexto de sessão e rotas protegidas
        │   ├── paginas/               uma pasta por tela do mapa de telas
        │   └── componentes/           campo, diálogo, selos, painel, estados de carregamento
        └── vite.config.ts             proxy de /api para a API em desenvolvimento
```

### 3.1 Ordem dos *middlewares*

A Listagem 1 mostra a ordem de aplicação dos *middlewares* em `app.ts`. A ordem garante que cabeçalhos, verificação de origem e limite de tamanho sejam aplicados antes de qualquer leitura de sessão ou de corpo.

```ts
const app = new Hono<Ambiente>()
  .use(registrarRequisicao(deps))
  .use(cabecalhosSeguranca())
  .use('/api/*', verificarOrigem(deps.config.origemPermitida))
  .use('/api/*', limitarCorpoPorRota(deps.config.evidenciasTamanhoMaximoBytes))
  .use('/api/*', carregarSessao())
  .use('/api/*', exigirSessao())
  .get('/api/health', (c) => c.json({ status: 'ok' as const }))
  .route('/api/auth', rotasAuth)
  .route('/api/usuarios', rotasUsuarios)
  .route('/api/projetos', rotasProjetos)
  .route('/api/achados', rotasAchados)
  .route('/api/categorias-owasp', rotasCategorias)
  .route('/api/painel', rotasPainel)
  .route('/api/evidencias', rotasEvidencias)

app.onError(tratarErro)
app.notFound(naoEncontrado)

export type AppType = ReturnType<typeof criarApp>
```

*Listagem 1 — Composição da aplicação em `app.ts`.*

O limite de 64 KB vale para corpos JSON; somente a rota de envio de evidências aceita o tamanho máximo do arquivo mais a folga do *multipart* (RNF14). O *middleware* `carregarSessao` apenas identifica o usuário, e `exigirSessao` recusa com 401 qualquer rota sob `/api`, exceto `GET /api/health` e `POST /api/auth/login`. Cada rota declara os papéis exigidos com `exigirPapel`, e as regras de propriedade ficam nas funções de domínio. A aplicação é criada pela função `criarApp(deps)`, que recebe banco, configuração, *log* e armazenamento; os testes usam a mesma função com um banco isolado.

## 4. Decisões técnicas

| ID | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| DT01 | Hono | AdonisJS, NestJS, Elysia | *Framework* mínimo, com *middlewares* de segurança nativos e cliente RPC tipado. Os demais controles são implementados pela equipe e ficam explícitos no código, o que facilita relacioná-los ao modelo de ameaças. O Elysia foi descartado por depender do Bun. |
| DT02 | Sessão em banco com *cookie* `HttpOnly` | JWT em `localStorage` ou JWT sem estado | *Token* em `localStorage` fica acessível a qualquer *script* da página; uma falha de XSS exporia a sessão. JWT sem estado não permite revogar a sessão na saída, na troca de senha ou na desativação. |
| DT03 | Mesma origem para front-end e API | Origens separadas com CORS | Permite `SameSite=Strict` e elimina a configuração de CORS. |
| DT04 | Drizzle ORM | Prisma, SQL manual | Consultas tipadas próximas do SQL, sem motor de consultas separado. SQL manual aumentaria o risco de concatenação. |
| DT05 | Regras de transição em funções puras de domínio | Regras nos *handlers* das rotas | Ponto único de verdade, testável sem HTTP e sem banco. |
| DT06 | Papéis globais | Papéis por projeto | Reduz a modelagem de autorização ao escopo do protótipo (ver itens fora do escopo). |
| DT07 | Exclusão lógica (arquivamento e encerramento) | Exclusão física | Preserva o histórico e a rastreabilidade (RN07, RN08). |
| DT08 | Concorrência otimista com coluna `versao` | Última gravação prevalece | Evita que uma transição sobrescreva outra feita em paralelo. |
| DT09 | Evidências em volume de disco | Evidências no banco (`bytea`) | Mantém o banco pequeno; o volume não é exposto pelo *proxy*. |
| DT10 | Esquemas Zod em pacote compartilhado | Validação duplicada no front-end e no back-end | Uma única definição de regra de entrada para os dois lados. |
| DT11 | Verificação de origem própria (`verificarOrigem`) | *Middleware* `csrf` nativo do Hono | O `csrf` do Hono só verifica corpos de formulário e aceita JSON de qualquer origem; a verificação própria vale para qualquer tipo de conteúdo (registrado como `VULN-0008` no documento 08). |
| DT12 | Histórico protegido por gatilho no banco | Proteção apenas no código | O PostgreSQL recusa `UPDATE`, `DELETE` e `TRUNCATE` em `eventos_historico`, mesmo que a aplicação tente (A07). |
| DT13 | Chave estrangeira composta (`ativo_id`, `projeto_id`) | Validação apenas na aplicação | Garante no banco que o ativo vinculado pertence ao projeto do achado (RF22). |
| DT14 | PDF desenhado por código (`pdfkit`) | Conversão de HTML para PDF | Nenhum conteúdo cadastrado é interpretado como marcação; evita navegador embutido no servidor. |
| DT15 | Versão conferida antes das regras de transição | Regras antes da versão | Uma ação feita sobre um estado desatualizado recebe sempre "Conflito de versão" (409), o que orienta o usuário a recarregar. |

## 5. Contrato da API

Todas as rotas ficam sob `/api`, exigem sessão válida (exceto `POST /api/auth/login`) e respondem em JSON. Erros seguem o formato *Problem Details* (RFC 9457), sem pilha de execução. Requisições `POST`, `PUT`, `PATCH` e `DELETE` vindas de origem diferente da configurada são recusadas pelo *middleware* `verificarOrigem` (RNF05).

**Tabela 2 — Rotas da API**

| Método | Rota | Papéis | Descrição | Req. |
|---|---|---|---|---|
| POST | `/api/auth/login` | público | Entrada com e-mail e senha; cria sessão. | RF01 |
| POST | `/api/auth/logout` | todos | Apaga a sessão atual. | RF02 |
| GET | `/api/auth/me` | todos | Dados e papel do usuário atual. | — |
| PUT | `/api/auth/senha` | todos | Troca da própria senha; revoga as demais sessões. | RF05 |
| GET | `/api/usuarios` | Admin | Lista usuários. | RF03 |
| POST | `/api/usuarios` | Admin | Cadastra usuário. | RF03 |
| PATCH | `/api/usuarios/{id}` | Admin | Altera papel ou desativa; desativação revoga sessões. | RF04 |
| GET | `/api/usuarios/responsaveis` | Analista, Admin | Usuários ativos para atribuição. | RF15 |
| GET | `/api/projetos` | todos | Lista projetos com contagens. Filtro `arquivados`. | RF10 |
| POST | `/api/projetos` | Analista, Admin | Cria projeto. | RF07 |
| GET | `/api/projetos/{id}` | todos | Detalhe do projeto. | — |
| PUT | `/api/projetos/{id}` | Analista, Admin | Edita projeto. | RF08 |
| POST | `/api/projetos/{id}/arquivar` | Analista, Admin | Arquiva projeto. | RF09 |
| GET | `/api/projetos/{id}/painel` | todos | Indicadores do projeto. | RF27 |
| GET | `/api/painel` | todos | Indicadores gerais. | RF28 |
| GET | `/api/projetos/{id}/ativos` | todos | (D) Lista ativos. | RF11 |
| POST | `/api/projetos/{id}/ativos` | Analista, Admin | (D) Cadastra ativo. | RF11 |
| GET | `/api/achados` | todos | Lista com filtros e paginação. | RF18 |
| POST | `/api/projetos/{id}/achados` | Analista, Admin | Registra achado. | RF12 |
| GET | `/api/achados/{id}` | todos | Detalhe, com ações permitidas ao usuário. | RF19 |
| PUT | `/api/achados/{id}` | Analista, Admin | Edita campos (achado não encerrado). | RF12, RN05 |
| PUT | `/api/achados/{id}/responsavel` | Analista, Admin | Atribui ou remove responsável. | RF15 |
| POST | `/api/achados/{id}/transicoes` | conforme Tabela 7 do doc. 03 | Altera status. | RF16, RF17 |
| GET | `/api/achados/{id}/historico` | todos | Eventos do achado, incluindo comentários. | RF20 |
| GET | `/api/achados/{id}/evidencias` | todos | (D) Lista evidências. | RF25 |
| POST | `/api/achados/{id}/comentarios` | todos (Dev só nos seus) | (D) Comenta. | RF21 |
| POST | `/api/achados/{id}/evidencias` | todos (Dev só nos seus) | (D) Envia evidência (`multipart/form-data`). | RF25 |
| GET | `/api/evidencias/{id}/download` | todos | (D) Baixa evidência. | RF26 |
| DELETE | `/api/evidencias/{id}` | Analista, Admin; autor | (D) Remove evidência. | RF26 |
| GET | `/api/projetos/{id}/relatorio.csv` | todos | (D) Exporta CSV. | RF29 |
| GET | `/api/projetos/{id}/relatorio.pdf` | todos | (D) Gera PDF. | RF30 |
| GET | `/api/categorias-owasp` | todos | Catálogo de categorias. | RF14 |
| GET | `/api/health` | público | Verificação de funcionamento. | — |

### 5.1 Exemplos de corpo

Registro de achado (`POST /api/projetos/{id}/achados`):

```json
{
  "titulo": "Credenciais trafegam em texto claro via Telnet",
  "descricao": "O serviço Telnet na porta 23 aceita autenticação sem criptografia.",
  "origem": "AnaliseRede",
  "severidade": "Alta",
  "localizacao": "10.0.0.15:23/tcp",
  "impacto": "Captura de usuário e senha por qualquer nó no mesmo segmento.",
  "passosReproducao": "Capturar tráfego no Wireshark e seguir o fluxo TCP da sessão.",
  "correcaoProposta": "Desativar o Telnet e usar SSH com autenticação por chave.",
  "categoriaOwaspId": 2,
  "cweId": 319,
  "responsavelId": null
}
```

Transição (`POST /api/achados/{id}/transicoes`):

```json
{
  "destino": "FalsoPositivo",
  "justificativa": "O endpoint exige autenticação; a resposta 200 era da página de login.",
  "versao": 4
}
```

Filtros da listagem (`GET /api/achados`): `projetoId`, `status` (repetível), `severidade` (repetível), `responsavelId`, `semResponsavel`, `categoriaOwaspId`, `ativoId`, `vencido`, `busca` (título ou código), `ordenarPor` (`severidade`, `criadoEm`, `dataLimite`), `ordem` (`asc`, `desc`), `pagina`, `tamanhoPagina` (máximo 100). Parâmetros desconhecidos são recusados com 400. O campo `ordenarPor` é validado contra essa lista fechada antes de chegar à consulta.

### 5.2 Códigos de resposta

| Código | Situação |
|---|---|
| 200 / 201 / 204 | Sucesso. |
| 400 | Falha de validação, com lista de campos em `errors`. |
| 401 | Sessão ausente, expirada ou revogada. |
| 403 | Papel ou propriedade não autorizados, ou origem não permitida. |
| 404 | Recurso inexistente. |
| 409 | Transição inválida, projeto arquivado ou conflito de versão. |
| 413 | Corpo ou evidência acima do limite. |
| 415 | Tipo de arquivo não permitido. |
| 429 | Conta bloqueada por excesso de tentativas de entrada. |

## 6. Configuração

Variáveis de ambiente lidas pela API e validadas com Zod na inicialização; a API não sobe se alguma estiver ausente ou inválida (RNF12). O repositório contém apenas o arquivo `.env.example`, sem valores reais.

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL. |
| `ORIGEM_PERMITIDA` | Origem aceita pelo *middleware* `csrf` (ex.: `https://localhost`). |
| `EVIDENCIAS_DIRETORIO` | Caminho do volume de evidências. |
| `EVIDENCIAS_TAMANHO_MAXIMO_BYTES` | Padrão `5242880`. |
| `ADMIN_EMAIL_INICIAL`, `ADMIN_SENHA_INICIAL` | Criação do primeiro administrador quando o banco está vazio. |
| `PRAZO_DIAS_CRITICA`, `PRAZO_DIAS_ALTA`, `PRAZO_DIAS_MEDIA`, `PRAZO_DIAS_BAIXA` | Prazos de correção da RN10, em dias. Padrões 7, 30, 90 e 180. |
| `DEMO_SENHA` | Senha dos usuários da carga de demonstração (apenas `development`). |
| `PORT`, `LOG_LEVEL` | Porta da API (padrão 3000) e nível do *log* (padrão `info`). |
| `NODE_ENV` | `development` habilita a carga de demonstração. Em qualquer ambiente, detalhes de erro aparecem apenas no *log*. |
