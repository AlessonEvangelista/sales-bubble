# Plano de Pesquisa com Usuários — Teste de Usabilidade do Protótipo (Gate A)

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) · [Spec do Produto](../../SPEC.md) · [Plano v2 §3 Gate A](../planing-project.md) · [Personas e jornadas](../02-discovery/personas-jornadas.md) · [Business case §8 (H1–H8)](../01-negocio/business-case.md) · [Fluxos](arquitetura-informacao-fluxos.md) · [Telas](especificacao-telas.md)

> O Gate A exige "protótipo navegável do canvas validado com usuários". Este plano define **o que** validar, **com quem**, **como** e **qual resultado** libera, ajusta ou bloqueia o escopo da Release 1.0. Executado na **S0 (12/10 – 23/10/2026)**; o recrutamento começa já em 07/10.

---

## 1. Objetivos

| # | Objetivo | Decisão que informa |
| :--- | :--- | :--- |
| O1 | Verificar se as pessoas entendem o **modelo mental da bolha**: cotas, meta mínima, degraus, preço final único, explosão e devolução automática | Comunicação do preço (ADR-0004) e da reserva (ADR-0003) |
| O2 | Medir se conseguem **encontrar e avaliar** uma bolha no canvas (pan/zoom, LOD, flags) e se a **lista** é uma alternativa equivalente | Escopo do E3 (canvas) e prioridade da lista |
| O3 | Medir se conseguem **entrar e sair** de uma bolha (cartão e Pix com reserva) sem dúvida sobre quanto e quando pagam | H1 (business case), fluxo F5 |
| O4 | Medir se uma PJ consegue **criar uma bolha de venda com degraus** que represente sua política de desconto | H2, formulário F3 |
| O5 | Medir se uma organizadora consegue **criar uma bolha de compra e escolher um lance** | Fluxos F4/F8, R9 |
| O6 | Verificar a compreensão da **triagem** (prazos, atraso, arrependimento, caso) e do **score** | F9/F10 |
| O7 | Levantar barreiras de acessibilidade com usuários de leitor de tela (amostra complementar) | [acessibilidade.md](acessibilidade.md) |

## 2. Hipóteses

Cada hipótese tem critério de sucesso definido **antes** do teste.

| ID | Hipótese | Evidência | Critério de sucesso |
| :--- | :--- | :--- | :--- |
| HU1 | Usuários entendem que pagam o **preço do degrau atingido na explosão**, igual para todos | Pergunta de compreensão após a tarefa P2 ("Se a bolha fechar com 72 cotas, quanto você paga?") | ≥ 4/5 PF e ≥ 4/5 organizadoras respondem certo sem ajuda |
| HU2 | A **reserva** (cartão pré-autorizado ou Pix com prazo) e a **devolução** se a meta falhar ficam claras antes de confirmar | Tarefa P3 + pergunta "O que acontece com seu dinheiro se a bolha não atingir a meta?" | ≥ 4/5 PF respondem certo; ninguém confirma achando que "já comprou" pelo preço inicial (ligada a H1) |
| HU3 | O canvas permite localizar e comparar bolhas em < 90 s | Tarefa P1 | Sucesso ≥ 80% e mediana ≤ 90 s |
| HU4 | Flags "Quase cheia" e "Expirando" são entendidas como **urgência**, não como estado final | Pergunta sobre uma bolha com as duas flags | ≥ 4/5 descrevem corretamente |
| HU5 | PJ monta os degraus da sua política de desconto em ≤ 5 min | Tarefa J1 | ≥ 4/5 concluem com degraus válidos; ≤ 1 erro de validação por participante em média (ligada a H2) |
| HU6 | Organizadora cria bolha de compra e escolhe lance sem confundir preço-alvo com preço final | Tarefas O1–O2 | ≥ 4/5 concluem; ≥ 4/5 explicam que o preço-alvo é o **máximo** |
| HU7 | A regra "saída bloqueada na última hora" é percebida como justa, não como armadilha | Tarefa P4 + escala 1–5 de justiça | Mediana ≥ 4 |
| HU8 | O usuário encontra o que fazer quando o vendedor atrasa (cancelar com estorno) e sabe que pode desistir em 7 dias | Tarefa P5 | ≥ 4/5 encontram a ação |
| HU9 | Usabilidade geral aceitável | SUS ao final | SUS médio ≥ 68 em cada persona (meta: ≥ 75) |

## 3. Método

- **Teste de usabilidade moderado**, remoto (videochamada com compartilhamento de tela) ou presencial, **60 min** por sessão, protocolo *think-aloud*.
- **Protótipo:** Figma navegável (E0) cobrindo T01, T02, T03, T12/T12p/T12b, T10, T11, T16/T16a, T17, T18/T19/T25, T20 — com dados realistas (Spec F6: degraus 0 → R$ 100 · 40 → R$ 90 · 70 → R$ 80 · 100 → R$ 75). O canvas é simulado com 20–30 bolhas e um "evento ao vivo" acionado pelo moderador (cota entrando, explosão).
- **Papéis:** 1 moderador (UX), 1 observador anotando (PO ou dev), demais observadores em sala separada sem interagir.
- **Piloto:** 1 sessão interna em 13/10 para calibrar tempos e roteiro.
- **Ética e LGPD:** termo de consentimento (gravação, uso interno, retenção de 90 dias, direito de desistir); dados pessoais dos participantes não entram no relatório (identificação por código, ex.: PF-03); gravações em armazenamento com acesso restrito.

## 4. Recrutamento

**Amostra principal: N = 5 por persona principal externa = 15 sessões.**

| Trilha | Persona | N | Critérios de inclusão | Exclusão |
| :--- | :--- | :---: | :--- | :--- |
| PF | **Carlos Silva** — consumidor coletivo | 5 | 25–45 anos; comprou online ≥ 3 vezes nos últimos 3 meses; compara preço em ≥ 2 sites ou participa de grupos de ofertas; usa cartão de crédito ou Pix | Trabalha com e-commerce/UX; participou de teste nos últimos 6 meses |
| PJ | **TecnoLotes Ltda** (operadora: Marina, gerente comercial) | 5 | Responsável comercial ou dono de empresa com CNPJ ativo que vende em lote/atacado; vende online ou por representantes; ≥ 1 promoção de volume no último ano. Prioridade para as **5 PJs parceiras do beta** (R9) | Concorrentes diretos |
| Organizadora | **Juliana Rocha** — organizadora de compra coletiva | 5 | Organizou ≥ 2 compras em grupo no último ano (clube, condomínio, associação, empresa), cobrando por Pix ou planilha | Idem PF |

- **Mistura de dispositivos:** em cada trilha, ≥ 2 sessões em celular (o protótipo mobile) e ≥ 2 em desktop.
- **Amostra complementar de acessibilidade (fora da contagem):** 2 usuários de leitor de tela (NVDA ou VoiceOver) testando T02 (lista), T03 e T12 — achados vão para o plano de acessibilidade, não para as métricas de HU.
- **Moderador/backoffice (persona Rafael):** não entra no teste com usuários; a fila de moderação passa por avaliação heurística interna.
- **Canais:** base de interessados da landing, grupos de ofertas e de compras coletivas, rede das PJs parceiras, painel de recrutamento.
- **Questionário de triagem (screener):** perfil (PF/PJ/organizador), frequência de compra online, experiência com compra coletiva, dispositivo, disponibilidade, consentimento.
- **Incentivo:** PF e organizadora R$ 100 em vale-presente; PJ: acesso antecipado ao beta + R$ 150 (ou doação), por 60 min.
- **Reservas:** recrutar 2 suplentes por trilha (taxa de não comparecimento esperada de 20%).

> Por que 5 por persona: cada persona usa uma interface distinta (comprar ≠ vender ≠ organizar). Cinco sessões por perfil revelam os problemas mais frequentes daquela interface; o Plano (Gate A) e o business case (H1) citam "5 usuários/entrevistas" — este plano amplia para 5 **por persona** (ver §9).

## 5. Roteiro da sessão (60 min)

| Bloco | Tempo | Conteúdo |
| :--- | :---: | :--- |
| Abertura | 5 min | Consentimento, "estamos testando o produto, não você", pensar em voz alta |
| Contexto | 7 min | Como compra/vende/organiza hoje; última compra em grupo ou promoção de volume |
| Primeira impressão | 3 min | Home (canvas) sem tocar: "O que é isso? O que você pode fazer aqui?" |
| Tarefas | 35 min | Por trilha (abaixo); após cada tarefa: SEQ (1–7) e pergunta de compreensão |
| Encerramento | 10 min | SUS, "o que mais confundiu?", "usaria? por quê?", objeções (limite do cartão preso, confiança no vendedor) |

### 5.1 Tarefas — trilha PF (Carlos)

| # | Cenário (como é lido ao participante) | Sucesso |
| :--- | :--- | :--- |
| P1 | "Você quer um fone Bluetooth. Encontre uma bolha de fone que termine ainda hoje e diga quanto custaria se fechasse agora." | Abre a bolha certa e lê o "se fechar agora" |
| P2 | "Explique como o preço desta bolha funciona. Se fechar com 72 cotas, quanto você paga? E quem entrou primeiro?" | Resposta: R$ 80, igual para todos (HU1) |
| P3 | "Entre nesta bolha pagando com Pix." → (moderador: o Pix expira) → "O que aconteceu? Entre de novo com cartão." | Entende reserva, prazo e liberação; conclui com cartão (HU2) |
| P4 | "Você mudou de ideia. Saia da bolha." (bolha na última hora) | Encontra a explicação do bloqueio e a descreve (HU7) |
| P5 | "A bolha fechou e o vendedor está atrasado. O que você pode fazer?" → "Recebeu e não gostou. E agora?" | Encontra "Cancelar com estorno integral" e "Desistir da compra" (HU8) |
| P6 (opcional) | "Ache a mesma bolha usando a lista em vez do mapa." | Usa a alternância Canvas/Lista |

### 5.2 Tarefas — trilha PJ (TecnoLotes)

| # | Cenário | Sucesso |
| :--- | :--- | :--- |
| J1 | "Você tem 100 fones parados. Crie uma bolha de venda: R$ 100 cada, até R$ 75 se vender tudo, e só vende se tiver pelo menos 40 interessados." | Bolha com degraus válidos e meta 40 (HU5) |
| J2 | "Antes de publicar: se fechar com 72 cotas, quanto você recebe por unidade, já descontada a taxa?" | Lê o repasse líquido na revisão |
| J3 | "Encontre uma bolha de compra de cadeiras e dê um lance. Depois, baixe o seu preço." | Envia e **substitui** o lance; entende que o anterior foi retirado |
| J4 | "Sua bolha fechou. Registre o envio de 3 pedidos e veja quais estão atrasados." | Usa a triagem; identifica a aba "Atrasados" |
| J5 | "Por que seu score caiu 15 pontos? Conteste se achar injusto." | Encontra o evento e abre a contestação |

### 5.3 Tarefas — trilha Organizadora (Juliana)

| # | Cenário | Sucesso |
| :--- | :--- | :--- |
| O1 | "Seu grupo de ciclismo quer 30 pneus. Ninguém quer pagar mais de R$ 150 cada. Crie uma bolha de compra e convide uma loja que você conhece." | Bolha com preço-alvo 150, meta coerente, convite; entende que ocupa a 1ª cota e paga com cartão (HU6) |
| O2 | "A bolha fechou com 4 lances. Escolha o melhor para o grupo e explique por quê." | Escolhe e confirma; entende o prazo de 24 h e o fallback |
| O3 | "Quanto cada pessoa do grupo vai pagar?" | Resposta: o preço do lance escolhido; diferença liberada |
| O4 | "Um participante diz que não recebeu. O que ele deve fazer?" | Aponta "Não recebi" (caso de triagem) |

## 6. Métricas

| Métrica | Como medir | Uso |
| :--- | :--- | :--- |
| **Sucesso da tarefa** | Binário (concluiu sem ajuda) + parcial (com 1 dica) + falha | Taxa por tarefa e por persona |
| **Tempo na tarefa** | Do fim da leitura do cenário à conclusão ou desistência | Mediana por tarefa (amostra pequena → mediana, não média) |
| **Erros** | Caminho errado, erro de validação, interpretação errada (slip × mistake anotados separadamente) | Contagem por tarefa; mistakes indicam modelo mental a corrigir |
| **Compreensão** | Perguntas fechadas pós-tarefa (HU1, HU2, HU4, HU6) | % de acerto |
| **SEQ** | Single Ease Question 1–7 após cada tarefa | Mediana por tarefa |
| **SUS** | 10 itens ao final (versão em português) | Média por persona; referência de mercado 68 |
| **Confiança/justiça** | Escala 1–5 ("eu confiaria meu dinheiro a isso"; "a regra é justa") | Insumo para H1 e HU7 |
| **Citações e objeções** | Notas do observador | Insumo qualitativo |

## 7. Análise

1. **Planilha arco-íris** (linhas = observações, colunas = participantes) preenchida durante as sessões pelo observador.
2. **Severidade** de cada problema (0 cosmético · 1 menor · 2 moderado · 3 grave · 4 bloqueante), considerando frequência, impacto e persistência.
3. **Classificação do erro:** *slip* (distração com objetivo correto → confirmação/desfazer) ou *mistake* (modelo mental errado → reescrever explicação, mudar fluxo).
4. **Síntese por afinidade** em 22/10: temas por hipótese HU1–HU9; cada achado com evidência (nº de participantes, citação, trecho de vídeo).
5. **Relatório** (até 23/10): resultado por hipótese (atingiu/não), top 10 problemas com severidade e recomendação, impactos em requisitos (RF/RN), ADRs e telas.
6. Achados viram itens de backlog com rastreabilidade (problema → tela T-xx → história US-xxx).

## 8. Critérios de decisão (Gate A)

| Resultado | Regra | Ação |
| :--- | :--- | :--- |
| **Aprovar** | HU1, HU2 e HU3 atingidas; SUS ≥ 68 em todas as personas; nenhum problema de severidade 4 aberto | Gate A segue para aprovação de escopo e ADRs |
| **Aprovar com ajustes** | Até 2 hipóteses não atingidas fora de HU1/HU2; problemas sev. 3 com correção clara de UI | Corrigir no protótipo e validar com 3 participantes extras na S1, sem bloquear o início do E1 |
| **Bloquear e revisar** | HU1 **ou** HU2 não atingida (o modelo de preço/pagamento não é entendido), ou SUS < 50 em alguma persona, ou sev. 4 no fluxo de entrar na bolha | Revisar a comunicação do preço e da reserva; se persistir, reabrir ADR-0003/ADR-0004 (ex.: mostrar só preço-alvo garantido, mudar a reserva). Nova rodada antes de fechar o Gate A |
| **Sinal de negócio** | < 3/5 PJs completam J1 ou rejeitam o modelo (degraus/meta/taxa) | Levar ao PO como evidência para H2/H3/H4; pode mudar a vertical antes do beta |

## 9. Cronograma e responsabilidades

| Data | Atividade | Responsável |
| :--- | :--- | :--- |
| 07–10/10 | Screener no ar, recrutamento e agendamento (15 + 6 suplentes + 2 a11y) | UX + PO |
| 12–14/10 | Protótipo Figma finalizado; piloto interno em 13/10 | UX |
| 15–21/10 | 15 sessões (≈ 3 por dia) + 2 sessões de acessibilidade | UX (moderação), PO/devs (observação) |
| 22/10 | Síntese e severidade | UX + PO + Tech Lead |
| 23/10 | Relatório e decisão no Gate A | PO + Tech Lead + Jurídico |

**Divergência registrada:** o Plano (Gate A) pede validação com "5 usuários" e o business case (H1) cita "5 entrevistas"; este plano usa **5 por persona principal** (15 sessões), porque uma amostra única de 5 misturaria três interfaces diferentes. Se a capacidade da S0 não comportar, a ordem de corte é: manter PF (5) e PJ (5) e reduzir Organizadora para 3.

---

## Fontes consultadas (AlterEgo)

- **asias-user-research** — *Skill "Pesquisa com Usuários"*: pesquisa como processo sistemático para entender comportamento e necessidades, não para medir satisfação → foco em compreensão do modelo mental (O1) além de métricas.
- **asias-user-research** — *Assumption Testing: Everything You Need to Know to Get Started* (Teresa Torres, Product Talk): testar suposições específicas em vez da ideia inteira; definir o critério de sucesso **antes** do teste; decidir com base no conjunto de testes, não num único resultado → hipóteses HU1–HU9 com critérios prévios (§2) e regras de decisão (§8).
- **asias-user-research** — *4 Powerful Ways to Use Rapid Prototyping to Drive Product Success* (Product Talk): protótipo simula uma experiência com a intenção de responder uma pergunta específica e iterar → protótipo Figma com "evento ao vivo" simulado (§3).
- **ux-ui-design / asias-ux-engineering** — *Introdução e boas práticas em UX Design* (Casa do Código), cap. 8 "Testando com usuários", p. 152–154, e cap. 2 (teste de usabilidade): sessão de ~1 h com facilitador ao lado, observadores em sala separada, tarefas escolhidas a partir de dados, questionário de satisfação ao final, brinde ao participante, relatório com recomendações; objetivos como medir sucesso, tempo e passos → §3, §5, §6, §7.
- **asias-ux-engineering** — *00 Skill*, "Ferramentas de apoio à medição": teste remoto com gravação e verbalização mantém o mesmo protocolo de 3–5 usuários e roteiro de tarefas; a feature que não bate a meta de sucesso definida antes volta para análise → §3, §4 e §8.
- **asias-design-interacao** — *Skill*: distinção *slip* × *mistake* (Norman) e o remédio diferente para cada um → classificação de erros (§6, §7).
- **business-analyst** (retornado na busca de asias-user-research) — Dean Leffingwell, *Agile Software Requirements*, cap. 7, p. 166–168: protótipos de baixa fidelidade e *UX story spikes* para obter feedback antes de codificar, priorizados cedo por esconderem risco → teste no S0, antes do E1.
