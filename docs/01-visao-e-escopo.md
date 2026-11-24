# 01 — Visão e escopo

## 1. Contexto e problema

Em equipes pequenas, os achados de segurança costumam ficar distribuídos entre planilhas, anotações, relatórios em PDF e mensagens. Essa dispersão dificulta responder a perguntas operacionais básicas: quais achados estão abertos, quem é responsável por cada um, quais são mais graves, quais passaram do prazo e como cada correção foi verificada.

Identificar a vulnerabilidade é apenas a primeira etapa. Depois dela, o achado precisa ser registrado com evidências, classificado, atribuído, corrigido, verificado e documentado. Sem um registro único, achados se repetem, correções deixam de ser verificadas e o histórico das decisões se perde.

## 2. Objetivo

Desenvolver um protótipo funcional de uma ferramenta web que organize o ciclo de vida de achados de segurança, do registro ao encerramento, com rastreabilidade das alterações e visão consolidada por projeto.

## 3. Público-alvo

- pequenas equipes de segurança e de desenvolvimento;
- laboratórios acadêmicos e grupos de pesquisa;
- turmas de disciplinas de segurança aplicada que registram achados de atividades práticas.

## 4. Relação com as disciplinas do módulo

| Disciplina | Forma de mobilização no projeto |
|---|---|
| Projeto e Desenvolvimento de Código Seguro | A própria ferramenta é construída com controles de segurança: autenticação, autorização por papel, armazenamento seguro de senhas, validação de entrada, upload seguro, registro de auditoria e modelo de ameaças (ver [05](05-modelo-de-ameacas.md)). |
| Segurança de Aplicações Web e Móveis | Os achados são classificados pelas categorias do OWASP Top 10 e pela *Common Weakness Enumeration* (CWE). Os dados de demonstração incluem vulnerabilidades web, como XSS, SQL Injection e falhas de controle de acesso. |
| Segurança de Redes | A ferramenta registra achados de origem em análise de rede, como serviços expostos e protocolos sem criptografia, com campos de localização do tipo host e porta e evidências como capturas de tráfego. |

## 5. Escopo do MVP

O produto mínimo viável (MVP) atende às funcionalidades mínimas definidas no enunciado da Trilha 3:

1. Autenticação de usuários e controle de acesso por papel.
2. Cadastro, edição e arquivamento de projetos.
3. Cadastro e edição de achados vinculados a um projeto.
4. Severidade qualitativa obrigatória em cada achado.
5. Status do achado controlado por uma máquina de estados (ver [03, seção 6](03-modelagem.md#6-máquina-de-estados-do-achado)).
6. Atribuição de responsável.
7. Descrição da correção proposta.
8. Classificação por categoria OWASP Top 10 e identificador CWE.
9. Listagem de achados com filtros por projeto, status, severidade e responsável.
10. Painel consolidado por projeto, com contagem por severidade e status e lista de achados vencidos.
11. Histórico de alterações de cada achado.

## 6. Escopo desejável (após o MVP)

Os itens abaixo entram apenas se o MVP estiver concluído e testado:

- cadastro de ativos dentro de um projeto (aplicação, API, servidor, repositório), com vínculo opcional ao achado;
- anexação de evidências (imagens, PDF, texto, capturas `.pcap`);
- comentários no achado;
- prazo de correção calculado a partir da severidade;
- exportação de relatório do projeto em CSV;
- exportação de relatório do projeto em PDF;
- campo opcional para identificador CVE e nota CVSS informada manualmente.

## 7. Fora do escopo

Os itens a seguir não fazem parte do projeto em nenhuma entrega:

- execução de varreduras, testes de intrusão ou qualquer tipo de detecção automática de vulnerabilidades;
- importação de resultados de ferramentas externas (Nmap, OWASP ZAP, Burp Suite, ferramentas SAST);
- integração com rastreadores de tarefas (Jira, GitHub Issues, GitLab Issues) ou com *pipelines* de integração contínua;
- deduplicação automática de achados;
- cálculo de nota CVSS a partir de vetores;
- sincronização com bases públicas de CVE ou CWE;
- notificações por e-mail, mensageria ou *webhooks*;
- autenticação federada (SSO, OAuth com provedores externos) e autenticação multifator;
- múltiplas organizações isoladas na mesma instância (*multi-tenancy*);
- permissões por projeto: os papéis são globais na instância;
- aplicativo móvel nativo;
- resumo automático de achados por inteligência artificial;
- implantação em ambiente de produção pública.

## 8. Limites e restrições

| Tipo | Restrição |
|---|---|
| Equipe | No máximo 4 integrantes. |
| Prazo | Semestre letivo da disciplina, com entregas parciais e apresentação final. Datas em [06](06-plano-de-entregas.md). |
| Natureza do produto | Protótipo acadêmico funcional, sem compromisso de disponibilidade, escala ou suporte. |
| Volume de dados | Dimensionado para dezenas de usuários, dezenas de projetos e alguns milhares de achados. Não há requisito de desempenho além do uso em demonstração. |
| Ambiente | Execução local via Docker Compose. Não há implantação pública obrigatória. |
| Dados | Apenas dados fictícios ou achados obtidos em ambientes de laboratório autorizados, como as atividades da disciplina e aplicações deliberadamente vulneráveis. Não se registram vulnerabilidades de sistemas de terceiros sem autorização. |
| Idioma | Interface e documentação em português. |
| Navegadores | Versões recentes de Chrome e Firefox em computador. Não há layout dedicado a celulares. |

## 9. Premissas

- Cada instância é usada por uma única equipe, que confia nos administradores.
- Os achados são cadastrados manualmente por analistas que já executaram a análise em outra ferramenta.
- A severidade é atribuída pelo analista com base na escala qualitativa da [seção 5 do documento 02](02-requisitos.md#5-regras-de-negócio); a ferramenta não a calcula.

## 10. Critérios de aceite do MVP

O MVP é considerado concluído quando o roteiro abaixo é executado de ponta a ponta sem intervenção no banco de dados:

1. O administrador entra no sistema e cadastra um analista e um desenvolvedor.
2. O analista cria um projeto e registra cinco achados de origens diferentes (rede, aplicação web e revisão de código), com severidade, categoria OWASP, CWE e correção proposta.
3. O analista atribui dois achados ao desenvolvedor e os move para "Em correção".
4. O desenvolvedor entra, vê apenas as ações permitidas ao seu papel e move um achado para "Aguardando verificação".
5. O analista verifica a correção e encerra o achado como "Corrigido"; outro achado é marcado como "Falso positivo" com justificativa.
6. O painel do projeto mostra as contagens corretas por severidade e status.
7. O histórico do achado encerrado mostra todas as transições, com usuário e data.
8. Uma tentativa do desenvolvedor de executar uma ação reservada ao analista, feita diretamente na API, retorna HTTP 403.
