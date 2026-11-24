# 02 — Requisitos

Prioridades: **M** = obrigatório no MVP; **D** = desejável, implementado após o MVP.

## 1. Papéis

Os papéis são globais na instância. Cada usuário possui exatamente um papel.

| Papel | Descrição |
|---|---|
| Administrador | Gerencia usuários e tem todas as permissões do analista. É o único papel que aceita risco. |
| Analista | Cria projetos, registra e classifica achados, atribui responsáveis e verifica correções. |
| Desenvolvedor | Consulta projetos e achados e conduz a correção dos achados atribuídos a ele. |

A Tabela 1 resume as permissões por ação.

**Tabela 1 — Matriz de permissões**

| Ação | Administrador | Analista | Desenvolvedor |
|---|:-:|:-:|:-:|
| Gerenciar usuários | ✓ | | |
| Criar e editar projeto | ✓ | ✓ | |
| Arquivar projeto | ✓ | ✓ | |
| Consultar projetos, achados e painel | ✓ | ✓ | ✓ |
| Registrar e editar achado | ✓ | ✓ | |
| Atribuir responsável | ✓ | ✓ | |
| Mover achado para "Em correção" | ✓ | ✓ | |
| Mover achado atribuído a si para "Aguardando verificação" | ✓ | ✓ | ✓ |
| Verificar correção ("Corrigido" ou retorno a "Em correção") | ✓ | ✓ | |
| Marcar "Falso positivo" | ✓ | ✓ | |
| Aceitar risco | ✓ | | |
| Reabrir achado encerrado | ✓ | ✓ | |
| Comentar e anexar evidência (D) | ✓ | ✓ | ✓ (só nos atribuídos a si) |
| Exportar relatório (D) | ✓ | ✓ | ✓ |

## 2. Requisitos funcionais

### 2.1 Autenticação e usuários

| ID | Requisito | Prioridade |
|---|---|:-:|
| RF01 | O sistema deve autenticar usuários por e-mail e senha. | M |
| RF02 | O sistema deve encerrar a sessão do usuário quando ele solicitar saída. | M |
| RF03 | O administrador deve cadastrar usuários informando nome, e-mail, papel e senha inicial. | M |
| RF04 | O administrador deve alterar o papel de um usuário e desativá-lo. Usuário desativado não consegue entrar. | M |
| RF05 | O usuário deve alterar a própria senha informando a senha atual. | M |
| RF06 | Na primeira entrada com senha definida pelo administrador, o sistema deve exigir a troca de senha. | D |

### 2.2 Projetos e ativos

| ID | Requisito | Prioridade |
|---|---|:-:|
| RF07 | O analista deve cadastrar projeto com nome, descrição e responsável técnico. | M |
| RF08 | O analista deve editar os dados de um projeto. | M |
| RF09 | O analista deve arquivar um projeto. Projeto arquivado não aceita novos achados e fica oculto da listagem padrão. | M |
| RF10 | O sistema deve listar projetos com a contagem de achados abertos por severidade. | M |
| RF11 | O analista deve cadastrar ativos em um projeto, com nome, tipo, identificador (URL, IP, host ou repositório) e ambiente. | D |

### 2.3 Achados

| ID | Requisito | Prioridade |
|---|---|:-:|
| RF12 | O analista deve registrar achado em um projeto ativo com: título, descrição, origem, severidade, localização, impacto, passos de reprodução e correção proposta. | M |
| RF13 | O sistema deve gerar para cada achado um código sequencial legível por projeto (ex.: `WEB-0007`). | M |
| RF14 | O analista deve classificar o achado por categoria OWASP Top 10 e informar o identificador CWE. Ambos são opcionais. | M |
| RF15 | O analista deve atribuir e trocar o responsável pela correção, escolhido entre usuários ativos. | M |
| RF16 | O sistema deve alterar o status do achado somente pelas transições permitidas na máquina de estados. | M |
| RF17 | Transições para "Falso positivo", "Risco aceito" e "Aberto" (reabertura) devem exigir justificativa textual. | M |
| RF18 | O sistema deve listar achados com filtros combináveis por projeto, status, severidade, responsável, categoria OWASP e situação de prazo, com paginação e ordenação. | M |
| RF19 | O sistema deve exibir o detalhe do achado com todos os campos, o histórico e as ações permitidas ao usuário atual. | M |
| RF20 | O sistema deve registrar no histórico cada criação, edição de campo, troca de responsável e transição de status, com usuário, data, valor anterior e valor novo. | M |
| RF21 | Os usuários devem adicionar comentários ao achado. | D |
| RF22 | O analista deve vincular o achado a um ativo do projeto. | D |
| RF23 | O analista deve informar identificador CVE e nota CVSS (0,0 a 10,0) de forma opcional. | D |
| RF24 | O sistema deve calcular a data-limite de correção a partir da severidade e permitir que o analista a altere. | D |

### 2.4 Evidências

| ID | Requisito | Prioridade |
|---|---|:-:|
| RF25 | O usuário deve anexar arquivos de evidência a um achado, com descrição curta. | D |
| RF26 | O sistema deve permitir baixar e remover evidências, respeitando a matriz de permissões. | D |

### 2.5 Painel e relatórios

| ID | Requisito | Prioridade |
|---|---|:-:|
| RF27 | O sistema deve exibir painel por projeto com: total de achados por severidade e por status, achados abertos sem responsável e achados vencidos. | M |
| RF28 | O sistema deve exibir painel geral com os mesmos indicadores agregados de todos os projetos ativos. | M |
| RF29 | O sistema deve exportar os achados de um projeto em CSV. | D |
| RF30 | O sistema deve gerar relatório do projeto em PDF com resumo, indicadores e lista de achados. | D |

## 3. Requisitos não funcionais

### 3.1 Segurança

| ID | Requisito | Prioridade |
|---|---|:-:|
| RNF01 | Senhas devem ser armazenadas apenas como *hash* com sal, usando o `PasswordHasher` do ASP.NET Core Identity (PBKDF2). | M |
| RNF02 | Senhas devem ter no mínimo 10 caracteres. | M |
| RNF03 | Após 5 tentativas de entrada malsucedidas, a conta deve ser bloqueada por 15 minutos. | M |
| RNF04 | A sessão deve usar *cookie* com os atributos `HttpOnly`, `Secure` e `SameSite=Strict` e expirar após 8 horas. | M |
| RNF05 | Requisições que alteram estado devem exigir *token* antifalsificação (proteção contra CSRF). | M |
| RNF06 | Toda autorização deve ser verificada no back-end, por papel e, quando aplicável, por propriedade do recurso (ex.: responsável pelo achado). A interface apenas oculta ações não permitidas. | M |
| RNF07 | Toda entrada deve ser validada no back-end quanto a tipo, tamanho e valores permitidos. | M |
| RNF08 | O acesso ao banco deve ocorrer apenas por consultas parametrizadas, via Entity Framework Core. Concatenação de SQL é proibida. | M |
| RNF09 | Conteúdo textual cadastrado deve ser exibido como texto. O uso de `dangerouslySetInnerHTML` é proibido no front-end. | M |
| RNF10 | Respostas HTTP devem incluir os cabeçalhos `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `X-Frame-Options: DENY`. | M |
| RNF11 | Mensagens de erro não devem expor pilha de execução, consultas SQL ou detalhes internos. | M |
| RNF12 | Segredos (senha do banco, chaves) devem vir de variáveis de ambiente e nunca ser versionados. | M |
| RNF13 | Eventos de autenticação (sucesso, falha, bloqueio) e ações administrativas devem ser registrados em log estruturado. | M |
| RNF14 | Evidências devem ter tamanho máximo de 5 MB, extensão em lista permitida (`.png`, `.jpg`, `.pdf`, `.txt`, `.pcap`, `.pcapng`), verificação de assinatura de arquivo, nome de armazenamento gerado pelo servidor e armazenamento fora da raiz pública. | D |
| RNF15 | O *download* de evidência deve usar `Content-Disposition: attachment`. | D |
| RNF16 | As dependências devem ser verificadas quanto a vulnerabilidades conhecidas (`dotnet list package --vulnerable` e `npm audit`) antes de cada entrega. | M |

### 3.2 Qualidade e operação

| ID | Requisito | Prioridade |
|---|---|:-:|
| RNF17 | O ambiente completo (banco, API e front-end) deve subir com um único comando `docker compose up`. | M |
| RNF18 | O banco deve ser criado e atualizado por *migrations* do Entity Framework Core. | M |
| RNF19 | Deve existir carga de dados de demonstração acionada por comando. | M |
| RNF20 | As regras de transição de status e de autorização devem ter testes automatizados. | M |
| RNF21 | A API deve ser documentada por OpenAPI, disponível apenas em ambiente de desenvolvimento. | M |
| RNF22 | Listagens devem responder em até 1 s com 5.000 achados em ambiente local. | D |

## 4. Regras de negócio

| ID | Regra |
|---|---|
| RN01 | Todo achado pertence a exatamente um projeto. A troca de projeto após o registro não é permitida. |
| RN02 | O código do achado é formado pelo prefixo do projeto (2 a 5 letras maiúsculas, único na instância) e por um número sequencial de 4 dígitos dentro do projeto. O código não se altera nem é reutilizado. |
| RN03 | Um achado só pode entrar em "Em correção" se tiver responsável. |
| RN04 | Somente o responsável pelo achado (ou analista/administrador) pode movê-lo para "Aguardando verificação". |
| RN05 | Os estados "Corrigido", "Falso positivo" e "Risco aceito" são de encerramento. Achados encerrados não aceitam edição de campos; para alterá-los, é necessário reabri-los. |
| RN06 | A data de encerramento é registrada na entrada em um estado de encerramento e apagada na reabertura. |
| RN07 | Achados não são excluídos. Registros indevidos são encerrados como "Falso positivo" com justificativa. |
| RN08 | Projetos não são excluídos; são arquivados. Um projeto só pode ser arquivado sem achados nos estados "Aberto", "Em correção" ou "Aguardando verificação". |
| RN09 | Um achado é considerado vencido quando possui data-limite anterior à data atual e não está encerrado. |
| RN10 | (D) A data-limite padrão é a data de registro somada ao prazo da severidade: Crítica 7 dias, Alta 30, Média 90, Baixa 180, Informativa sem prazo. Os valores são configuráveis e foram definidos pela equipe para o protótipo. |
| RN11 | Usuários desativados permanecem como autores no histórico, mas não podem ser escolhidos como responsáveis. Ao desativar um usuário, os achados abertos atribuídos a ele ficam sem responsável e retornam a "Aberto" quando estavam "Em correção". |

## 5. Escala de severidade

A severidade é qualitativa e atribuída pelo analista. Como referência, a escala acompanha as faixas qualitativas da especificação CVSS v3.1 [REFERÊNCIA NECESSÁRIA: FIRST, CVSS v3.1 Specification Document].

**Tabela 2 — Escala de severidade**

| Severidade | Faixa CVSS de referência | Exemplo de achado |
|---|---|---|
| Crítica | 9,0 – 10,0 | SQL Injection com acesso irrestrito ao banco em sistema exposto |
| Alta | 7,0 – 8,9 | Controle de acesso ausente em rota administrativa |
| Média | 4,0 – 6,9 | XSS refletido que exige interação do usuário |
| Baixa | 0,1 – 3,9 | Cabeçalho de segurança ausente sem impacto direto demonstrado |
| Informativa | 0,0 | Versão de servidor exposta no cabeçalho `Server` |

Os exemplos ilustram o uso da escala; a classificação real depende do contexto do sistema analisado.
