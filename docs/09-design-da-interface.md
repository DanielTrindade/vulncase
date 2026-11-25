# 09 — Design da interface

Este documento registra o plano visual da interface, elaborado antes do código conforme o processo da *skill* `frontend-design` (plano, revisão contra o *briefing*, construção e crítica), e as regras de movimento adotadas a partir da *skill* `emil-design-eng` e do `STANDARDS.md` de Emil Kowalski. Os componentes vêm do shadcn/ui, com Tailwind CSS v4, e recebem os tokens descritos aqui.

## 1. Assunto, público e tarefa principal

| Item | Definição |
|---|---|
| Assunto | Livro de registro de achados de segurança de uma equipe pequena de laboratório universitário. |
| Público | Analistas e desenvolvedores em computador, usando a ferramenta todos os dias e várias vezes ao dia. |
| Tarefa principal | Saber o que está aberto e é grave, quem é o responsável e avançar cada achado no ciclo de correção. |
| Tom | Preciso, calmo e confiável, como um prontuário técnico. Não é uma estética de "terminal *hacker*". |

## 2. Primeira passada do plano

**Cor.** A severidade é a única informação que grita; o restante da interface é monocromático.

| Nome | Hex | Papel |
|---|---|---|
| Grafite | `#1B1F24` | Texto principal. |
| Névoa | `#F2F4F3` | Fundo da aplicação, cinza com leve tom esverdeado. |
| Papel | `#FFFFFF` | Superfícies de conteúdo. |
| Petróleo | `#0B5D63` | Ações primárias, foco e seleção. O tom remete à água escura dos rios amazônicos, contexto da UFAM. |
| Linha | `#D8DEDB` | Bordas e divisórias. |

A escala de severidade é ordinal, do quente ao frio: Crítica `#A61B1B`, Alta `#C2410C`, Média `#A16207`, Baixa `#3F6E8C` e Informativa `#6B7280`. Cada cor aparece sempre acompanhada do rótulo, nunca sozinha.

**Tipografia.** Public Sans (família de código aberto criada para sistemas de governo, legível e com algarismos tabulares) em toda a interface; IBM Plex Mono apenas para identificadores que são de fato código: códigos de achado, localizações, CWE e *hashes*. Escala de 13, 14, 16, 20, 26 e 34 px (razão próxima de 1,25), pesos 400, 500 e 650.

**Layout.** Navegação lateral fixa, porque o uso é diário e a troca de seção é frequente. O painel abre com a **faixa de severidade**: uma única barra horizontal segmentada com os achados abertos de cada severidade, seguida de uma lista de pendências acionáveis. As tabelas são densas, com uma borda colorida de 3 px à esquerda de cada linha indicando a severidade. O detalhe do achado mostra o ciclo de vida como uma sequência de etapas, porque o conteúdo é de fato uma sequência.

```
┌──────────┬───────────────────────────────────────────────┐
│ VulnCase │ Painel geral                                  │
│          │ ████████████▓▓▓▓▓▓▓▓░░░░░░▒▒▒▒   12 abertos   │
│ Painel   │ Crítica 2  Alta 4  Média 3  Baixa 2  Info 1   │
│ Achados  │ ─────────────────────────────────────────────│
│ Projetos │ Precisa de atenção                            │
│ Usuários │  2 achados vencidos ........... Ver           │
│          │  3 abertos sem responsável .... Atribuir      │
│          │ ─────────────────────────────────────────────│
│ ──────── │ Abertos mais graves                           │
│ Ana A.   │ ▌WEB-0001  SQL Injection no login   Crítica   │
└──────────┴───────────────────────────────────────────────┘
```

**Princípios.** A severidade guia o olhar; a estrutura (bordas, etapas, listas) carrega informação, e não enfeite; o movimento responde a uma ação da pessoa.

## 3. Revisão contra os padrões genéricos

A Tabela 1 registra o que a primeira passada repetia dos padrões de interface gerada e o que mudou.

**Tabela 1 — Revisão do plano**

| Padrão genérico encontrado | Decisão |
|---|---|
| Quatro cartões idênticos com número grande e rótulo pequeno no topo do painel (padrão "SaaS"). | Substituídos pela faixa de severidade e por uma lista "Precisa de atenção", em que cada linha leva a uma ação. |
| Cartões arredondados com a mesma sombra cinza em tudo. | Painéis com borda e sem sombra; sombra apenas em camadas flutuantes (menus, diálogos e *toasts*). Raio de 6 px nos controles e de 10 px nos painéis. |
| Cabeçalhos de tabela em caixa alta com espaçamento largo. | Cabeçalhos em caixa de frase, peso 500 e cor secundária. |
| Metadados unidos por ponto médio (`A · B · C`). | Metadados em pares rótulo e valor ou em colunas. |
| Fonte monoespaçada em rótulos pequenos. | Reservada a identificadores que são código. |
| Tema padrão do shadcn/ui (cinza zinco e fonte Geist). | Paleta e tipografia próprias, descritas na seção 2. |
| Fundo quase preto tingido no tema escuro. | O tema escuro deriva do petróleo (`#101816`), e não de um preto genérico; a severidade mantém o contraste mínimo de 3:1 com a superfície. |

## 4. Movimento

Os valores seguem o `STANDARDS.md` de Emil Kowalski.

**Tabela 2 — Regras de movimento**

| Elemento | Frequência de uso | Decisão |
|---|---|---|
| Atalhos de teclado e navegação entre telas | Centenas de vezes por dia | Sem animação. |
| Linhas de tabela e itens de menu ao passar o mouse | Dezenas de vezes por dia | Apenas mudança de cor, 150 ms com `ease`, e só em dispositivos com mouse (`hover: hover`). |
| Botões | Frequente | `scale(0.97)` ao pressionar, 160 ms com `--ease-out`. |
| *Select*, menu suspenso e *tooltip* | Frequente | Entrada a partir de `scale(0.96)` e opacidade, com origem no gatilho; 150 a 200 ms com `--ease-out`; saída mais rápida que a entrada. *Tooltips* seguintes abrem sem atraso. |
| Diálogos | Ocasional | Centralizados, 220 ms com `--ease-out` na entrada e 150 ms na saída. |
| *Toasts* (Sonner) | Ocasional | Valores padrão do Sonner. |
| Faixa de severidade do painel | Uma vez por visita | O único momento orquestrado: revelação por `clip-path` em 600 ms com `--ease-in-out`. |

Curvas: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` e `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`. Nunca `ease-in` em interface, nunca `scale(0)` e nunca `transition: all`. Com `prefers-reduced-motion: reduce`, os movimentos de posição e escala são removidos e restam apenas transições de opacidade e cor.

## 5. Restrições de segurança

A interface continua sob a CSP sem `unsafe-inline`: as fontes são servidas pela própria aplicação (pacotes `@fontsource`), não há *script* externo e nenhum conteúdo cadastrado é interpretado como HTML.
