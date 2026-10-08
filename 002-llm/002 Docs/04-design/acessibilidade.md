# Plano de Acessibilidade (WCAG 2.1 AA) — Bolha Venda

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão
**Base:** [PRD v2.1](../../PRD.MD) (RNF05, RF02.3) · [Spec do Produto](../../SPEC.md) (F2, F7, §8 critério 4) · [Style guide](../style-guide.md) · [Especificação de telas](especificacao-telas.md)

> Meta: **WCAG 2.1 nível AA** em todo o produto, incluindo o canvas WebGL — que, por ser um `<canvas>`, não é acessível por si só (Plano E3). Critério de aceite da Release 1.0: canvas e lista acessível sem violações sérias no axe-core + teste manual com leitor de tela (Spec §8). Responsável: Frontend sênior + UX; QA valida.

---

## 1. Princípios

1. **Paridade de informação e de ação:** tudo o que o canvas mostra ou permite fazer existe numa estrutura DOM semântica (lista sincronizada + detalhe em HTML). O canvas é uma *visualização*, não o único caminho.
2. **HTML nativo primeiro, ARIA só quando necessário** (botões são `<button>`, listas são `<ul>`, diálogos usam `<dialog>`/padrão APG).
3. **Cor nunca é o único canal** (WCAG 1.4.1): tipo, flags e estados sempre têm ícone + texto (+ padrão de forma no canvas).
4. **Movimento é opcional:** `prefers-reduced-motion` e a preferência "Reduzir animações" (conta) desligam pulso, flutuação, partículas e transições de câmera.
5. **Tempo real sem ruído:** atualizações chegam ao leitor de tela resumidas e com *throttling*, priorizando o que importa ao usuário (bolhas em que participa e a bolha aberta).

---

## 2. Estratégia para o canvas WebGL

### 2.1 Arquitetura de camadas

```text
┌─ <main> ───────────────────────────────────────────────────────────────┐
│ [Pular para a lista de bolhas]   ← skip link (visível no foco)          │
│ <section aria-label="Mapa de bolhas" aria-describedby="ajuda-mapa">     │
│   <div role="toolbar" aria-label="Controles do mapa">                   │
│      Buscar · Filtros · Aproximar (+) · Afastar (−) · Centralizar ·     │
│      Alternar Canvas | Lista · Ajuda de teclado (?)                     │
│   <canvas aria-hidden="true">  ← PixiJS: só visual                     │
│   <ul class="camada-foco" aria-label="Bolhas na área visível (24)">     │
│      <li><button data-id=…  aria-describedby=…>                         │
│         "Venda: Fone XT-500. R$ 90,00 por cota. 65 de 100 cotas,        │
│          meta 40 atingida. Termina em 2 dias. Quase cheia."             │
│      </button></li> …   ← posicionados sobre as bolhas, transparentes,  │
│                           anel de foco visível desenhado no DOM          │
│ </section>                                                              │
│ <div aria-live="polite" class="sr-only" id="anuncios">  ← §2.4          │
│ <div role="alert" class="sr-only" id="alertas">         ← erros         │
└────────────────────────────────────────────────────────────────────────┘
```

- O `<canvas>` recebe `aria-hidden="true"`; a **camada de foco** é uma lista de botões reais, um por bolha **renderizada na viewport** (mesmo conjunto que o QuadTree devolve após o culling, limitado a 100 itens; acima disso o anúncio sugere "aproxime ou use a lista").
- Cada botão é posicionado (CSS `transform`) sobre a bolha correspondente, então clique/toque/foco coincidem com o visual; o **indicador de foco** é desenhado no DOM (contorno 3 px, contraste ≥ 3:1 contra o fundo e contra o gradiente), nunca só no WebGL.
- Elementos que saem da viewport são **removidos** da camada (não apenas deslocados), evitando foco em itens invisíveis.
- A ordem DOM segue a leitura visual (linhas de cima para baixo, esquerda → direita, agrupadas por faixas de 1/3 da altura) e é recalculada só quando a câmera para (debounce 250 ms), para não "pular" o foco.

### 2.2 Lista alternativa sincronizada (RF02.3, Spec F2)

- Alternância **Canvas | Lista** (`L`), persistida por usuário. A lista (`T02`) mostra as mesmas bolhas da área visível, com os mesmos filtros, ordenáveis por tempo restante, preço ou progresso.
- Usa os mesmos dados e a mesma assinatura WebSocket do canvas; ao voltar para o canvas, a câmera centraliza a bolha que estava em foco na lista (e vice-versa).
- **Não reordena sob o foco:** mudanças de ordem ficam pendentes com o botão "Atualizar ordem (N mudanças)".
- Se WebGL não estiver disponível, a lista é aberta automaticamente.

### 2.3 Teclado

| Tecla | Ação (com foco na região do mapa) |
| :--- | :--- |
| `Tab` / `Shift+Tab` | Entra na toolbar → camada de bolhas → sai da região (sem armadilha — 2.1.2) |
| `←` `↑` `→` `↓` (foco numa bolha) | Move o foco para a bolha mais próxima naquela direção (navegação espacial) |
| `Shift` + setas | Pan da câmera em passos de 25% da viewport |
| `+` / `−` | Aproximar / afastar (passos 1,25×, limites 0,1×–4×) |
| `0` | Centralizar e voltar ao zoom 1× |
| `Enter` / `Espaço` | Abrir o detalhe da bolha em foco |
| `Esc` | Fechar detalhe/menu e devolver o foco à bolha de origem |
| `L` | Alternar Canvas / Lista |
| `/` | Ir para a busca |
| `?` | Abrir a ajuda de atalhos |

- Atalhos de **uma tecla** só funcionam com foco dentro da região do mapa e podem ser desligados em Preferências (WCAG 2.1.4).
- Toda ação de gesto (arrastar, pinça, toque longo) tem alternativa por botão ou teclado (2.5.1); arrastar nunca é obrigatório.

### 2.4 Foco e anúncios (`aria-live`) com throttling

| Situação | Região | Regra |
| :--- | :--- | :--- |
| Bolha em foco ou com detalhe aberto: cota entrou/saiu | `polite` | No máximo **1 anúncio a cada 10 s por bolha**, com o estado mais recente: "Fone XT-500: 66 de 100 cotas. Preço agora R$ 90,00." |
| Mudança de degrau (preço caiu) numa bolha em que participo ou aberta | `polite` | Sempre anunciar, com prioridade sobre progresso: "Novo preço: R$ 80,00 por cota." |
| Bolha em que participo explodiu | `polite` | "A bolha Fone XT-500 fechou a R$ 80,00 por cota." / "…não atingiu a meta; o valor foi devolvido." |
| Outras bolhas da viewport | — | **Não anunciar** individualmente. Opcional (preferência): resumo a cada 60 s "3 bolhas atualizadas nesta área". |
| Flag `EXPIRING` ligada (bolha aberta ou em que participo) | `polite` | "Fone XT-500 termina em menos de 1 hora." |
| Contador regressivo | `role="timer"` com `aria-live="off"` | Anúncios só em marcos (1 h, 10 min, 1 min) para a bolha aberta |
| Erro de negócio que bloqueia a ação (ex.: `QUOTA_SOLD_OUT`) | foco movido para a mensagem (`tabindex="-1"`) + `role="alert"` | Mensagem exata da Spec |
| Sucesso de ação ("Você está na bolha!") | `role="status"` | Uma vez |
| Reconexão / offline | `role="status"` | "Sem conexão. Os dados podem estar desatualizados." e "Conexão restabelecida." |

- As regiões `aria-live` existem desde o carregamento da página (injetá-las depois não funciona de forma confiável) e há **uma** região `polite` global, para não competir.
- Fila de anúncios no cliente: coalescência por bolha (último estado vence), prioridade (erro > degrau/explosão > progresso), descarte de mensagens com mais de 15 s.
- Ao abrir o detalhe, o foco vai para o título (`<h2 tabindex="-1">`); ao fechar, volta à bolha de origem (ou ao item da lista).
- Drawer/sheet/modal: foco preso **dentro** enquanto aberto (padrão de diálogo modal), `Esc` fecha, conteúdo de fundo com `inert`.

### 2.5 Movimento reduzido (`prefers-reduced-motion` e preferência da conta)

| Animação (style-guide) | Padrão | Com movimento reduzido |
| :--- | :--- | :--- |
| Hover `scale(1.05)` 200 ms | Ligada | Sem escala: só contorno/sombra |
| Pulso aquático ao entrar cota | Onda circular | Desligado: contador numérico muda + marcador "+1" estático por 2 s |
| Pulso da flag `EXPIRING` | Pulsação contínua | Sem pulsação: ícone de relógio + texto em destaque |
| Explosão em partículas | Desintegração | **Fade** de 200 ms para o estado "Encerrada" (Spec F7) |
| Física de flutuação | Deriva suave | Bolhas estáticas |
| Inércia do pan / transições de câmera | Animadas | Instantâneas |

- Regras independentes da preferência: nenhuma animação pisca mais de **3 vezes por segundo** (2.3.1 — vale para as partículas da explosão); animação automática com mais de 5 s (flutuação, pulso de `EXPIRING`) pode ser pausada pelo botão "Pausar animações" na toolbar (2.2.2).
- No PixiJS, a preferência é lida de `matchMedia('(prefers-reduced-motion: reduce)')` + `preferences.reduce_motion` da conta, e escutada em tempo real (`change`).

### 2.6 Cor nunca como único canal

| Informação | Cor | Canais adicionais |
| :--- | :--- | :--- |
| Tipo Venda | Azul → roxo | Ícone de etiqueta, preenchimento sólido, texto "Venda" |
| Tipo Compra | Verde → ciano | Ícone de carrinho, contorno tracejado, texto "Compra" |
| Quase cheia | Borda âmbar | Ícone "quase cheia" + texto "Quase cheia" |
| Expirando | Vermelho no contador | Ícone de relógio + "Termina em 42 min" |
| Encerrada | Cinza | Ícone ✓/✕ + "Encerrada" |
| Progresso / meta | Anel | Fração textual + marcador de meta com rótulo |
| Faixa de score | Cor da faixa | Nome da faixa (Risco, Regular, Bom, Excelente) + número |
| Erro de formulário | Vermelho | Ícone + texto do erro + `aria-invalid` + `aria-describedby` |

Contraste: texto ≥ 4,5:1 (≥ 3:1 para texto grande ≥ 18,66 px negrito/24 px); componentes e ícones informativos ≥ 3:1 (1.4.11). O texto branco sobre o gradiente Compra (`#10B981`/`#06B6D4`) e a borda âmbar `#F59E0B` sobre o fundo claro `#F8FAFC` **não atingem** esses mínimos sem ajuste — usar sobreposição escura sob o texto e uma variante de borda mais escura no tema claro (validar tokens no S0).

---

## 3. Checklist por componente

| Componente | Critérios WCAG | Verificações |
| :--- | :--- | :--- |
| **Skip link + landmarks** | 2.4.1, 1.3.1 | "Pular para a lista de bolhas" e "Pular para o conteúdo"; `header`/`nav`/`main`/`footer`; 1 `h1` por página |
| **Toolbar do mapa** | 2.1.1, 4.1.2, 2.5.3 | `role="toolbar"` com setas entre itens; nomes acessíveis que contêm o rótulo visível; botões ≥ 44×44 px |
| **Camada de foco das bolhas** | 1.1.1, 2.4.3, 2.4.7, 4.1.2 | Nome acessível completo (tipo, título, preço, progresso, meta, tempo, flags); ordem lógica; foco visível ≥ 3:1; itens fora da viewport removidos |
| **Lista alternativa** | 1.3.1, 1.3.2, 4.1.3 | `<ul>`/`<li>`; ordenação com `aria-sort` ou anúncio "Ordenado por tempo restante"; não reordena sob foco |
| **Detalhe (drawer/sheet)** | 2.4.3, 2.1.2, 4.1.2 | Diálogo com `aria-labelledby`; foco inicial no título; `Esc`; foco devolvido; fundo `inert` |
| **Escada de degraus** | 1.3.1, 1.4.1 | Tabela `<table>` com cabeçalhos ("A partir de", "Preço por cota", "Situação"); degrau atual indicado por texto "atual" |
| **Barra de progresso** | 1.1.1, 4.1.2 | `role="progressbar"` com `aria-valuenow`, `aria-valuemax` e `aria-valuetext="65 de 100 cotas, meta 40 atingida"` |
| **Contador regressivo** | 2.2.1, 4.1.3 | `role="timer"`; texto com data absoluta para leitores ("termina em 26/11 às 9h"); o prazo da bolha é limite real do evento (exceção de 2.2.1), explicado no texto |
| **Contador do Pix (até 15 min)** | 2.2.1 | Aviso antes de expirar (2 min); botão "Gerar novo Pix" após expirar; o limite é inerente à reserva (exceção de tempo real) |
| **Modal "Entrar na bolha" / pagamento** | 3.3.1, 3.3.3, **3.3.4** | Revisão explícita do valor antes de confirmar; checkbox não pré-marcado; erros com sugestão; idempotência evita dupla cobrança; campos do SDK do gateway testados com leitor de tela |
| **Formulários de criação (T10/T11)** | 1.3.5, 3.3.1–3.3.4, 3.2.2 | `autocomplete` em dados pessoais; erros inline + resumo com links; passos com `aria-current="step"`; mudar de passo só por ação explícita; revisão antes de publicar |
| **Editor de degraus** | 2.1.1, 4.1.2, 3.3.1 | Cada linha com rótulos ("Degrau 2: a partir de N cotas", "preço por cota"); botão remover com nome "Remover degrau 2"; gráfico com alternativa textual (a tabela já é a alternativa) |
| **Upload de imagens** | 1.1.1, 2.1.1 | Campo de texto alternativo por imagem; upload por teclado; progresso anunciado |
| **Tabela de triagem (T17)** | 1.3.1, 2.1.1 | Cabeçalhos `<th scope>`; seleção por checkbox com nome ("Selecionar Carlos Silva"); ações em lote anunciam o resultado |
| **Toasts e notificações** | 4.1.3, 2.2.1 | `role="status"`; permanência ≥ 5 s e pausa no hover/foco; também listadas na central (não somem de vez) |
| **Badge de notificações** | 1.1.1 | "3 notificações não lidas" no nome acessível |
| **Gráfico de preço / score** | 1.1.1 | Descrição textual ou tabela equivalente |
| **Banner de conexão** | 4.1.3 | `role="status"`, não rouba foco |
| **Página toda** | 1.4.4, 1.4.10, 1.4.12, 3.1.1 | Zoom 200% sem perda; reflow a 320 px sem rolagem horizontal (exceto o canvas, cuja alternativa é a lista); espaçamento de texto ajustável; `lang="pt-BR"` |
| **Alvos de toque** | 2.5.5 (AAA, meta interna) | ≥ 44×44 px em ações; mínimo absoluto 24×24 px com espaçamento |

---

## 4. Testes

### 4.1 Automatizados (CI)

| Camada | Ferramenta | Regra de bloqueio |
| :--- | :--- | :--- |
| Componentes (`packages/ui-components`) | Vitest + `vitest-axe` (axe-core) | Falha o build com qualquer violação `serious`/`critical` |
| Páginas e fluxos | Playwright + `@axe-core/playwright` em T01 (modo lista e camada de foco), T02, T03, T10, T11, T12, T17, T18, T20, T23 | Falha o PR com `serious`/`critical`; `moderate` vira issue |
| Teclado | Playwright: roteiros "só teclado" (entrar na bolha, criar bolha, registrar envio) com asserções de foco | Falha se o foco se perder ou ficar preso |
| Movimento reduzido | Playwright com `reducedMotion: 'reduce'` | Nenhuma animação de partículas/pulso iniciada (flag de teste no renderer) |
| Contraste dos tokens | Script sobre os tokens do tema (claro/escuro) | Falha se par texto/fundo < 4,5:1 ou componente < 3:1 |
| Lint | `eslint-plugin-jsx-a11y` | Erro no CI |

> O axe-core não enxerga o conteúdo desenhado no `<canvas>`: ele valida a **camada de foco** e a lista. Por isso os testes manuais abaixo são obrigatórios.

### 4.2 Manuais (a cada sprint com UI e antes dos Gates C, D e E)

| Tecnologia assistiva | Navegador | Fluxos |
| :--- | :--- | :--- |
| **NVDA** (Windows) | Firefox e Chrome | Explorar canvas/lista, abrir detalhe, entrar na bolha (cartão), sair, criar bolha de venda, triagem do comprador |
| **VoiceOver** (macOS) | Safari | Mesmos fluxos |
| **VoiceOver** (iOS) | Safari | Canvas mobile (sheet), entrar na bolha, Pix, notificações |
| TalkBack (Android) | Chrome | Fumaça dos fluxos principais (beta) |
| Só teclado | Chrome/Firefox | Todos os fluxos críticos |
| Zoom 200%/400% e reflow 320 px | Chrome | Detalhe, formulários, triagem |
| Modo de alto contraste do Windows (`forced-colors`) | Edge | Bolhas, foco, ícones de flag |
| `prefers-reduced-motion` ligado no SO | Todos | Canvas, explosão, Pix |

Registro: planilha por critério WCAG × tela, com evidência (vídeo curto ou print) e severidade; defeitos de acessibilidade usam a mesma régua de severidade dos demais (S1 bloqueia o Gate E).

### 4.3 Com pessoas

- Incluir **2 participantes usuários de leitor de tela** no teste de usabilidade do protótipo navegável (fora da amostra principal — ver [plano-pesquisa-usuario.md](plano-pesquisa-usuario.md)) e repetir no beta fechado (S8).

---

## 5. Critérios de aceite

- **CA-A11Y-01 (canvas por teclado):** *Dado* um usuário só de teclado na home, *quando* pressiona `Tab` até a região do mapa e usa as setas, *então* o foco percorre as bolhas visíveis com indicador visível e `Enter` abre o detalhe com foco no título; `Esc` devolve o foco à mesma bolha.
- **CA-A11Y-02 (paridade da lista):** *Dado* o canvas com N bolhas na área visível e filtros aplicados, *quando* alterna para Lista, *então* a lista mostra as mesmas N bolhas com tipo, preço, progresso, meta, tempo e flags em texto.
- **CA-A11Y-03 (anúncios com throttling):** *Dado* um usuário de leitor de tela com o detalhe de uma bolha aberto e 30 cotas entrando em 10 s, *então* ele ouve no máximo 1 anúncio de progresso a cada 10 s, sempre com o estado mais recente, e um anúncio específico se o preço mudar de degrau.
- **CA-A11Y-04 (movimento reduzido):** *Dado* `prefers-reduced-motion: reduce` ou "Reduzir animações" ativo, *quando* uma bolha recebe cota ou explode, *então* não há pulso, partículas nem flutuação; a explosão aparece como fade ≤ 200 ms.
- **CA-A11Y-05 (cor):** *Dado* a tela em escala de cinza, *então* é possível distinguir Venda × Compra, "Quase cheia", "Expirando" e "Encerrada" por ícone, forma e texto.
- **CA-A11Y-06 (erros):** *Dado* que a última cota acabou durante a confirmação, *então* o foco vai para a mensagem "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado." e o leitor a anuncia.
- **CA-A11Y-07 (pagamento):** *Dado* o modal de entrada, *então* o valor reservado e a regra do preço final são lidos antes do botão de confirmação, e não há checkbox pré-marcado.
- **CA-A11Y-08 (CI):** nenhuma violação axe-core `serious`/`critical` nas páginas listadas em §4.1.
- **CA-A11Y-09 (manual):** os fluxos de §4.2 concluídos com NVDA e VoiceOver sem bloqueio (nenhum defeito S1/S2 aberto) antes do Gate E.
- **CA-A11Y-10 (reflow/zoom):** detalhe, formulários e triagem utilizáveis a 320 px e a 200% de zoom sem perda de conteúdo.

---

## Fontes consultadas (AlterEgo)

- **a11y-specialist** — *WebAIM: Introduction to ARIA*: as 5 regras de uso de ARIA (HTML nativo primeiro; controles ARIA operáveis por teclado; elementos focáveis com semântica e nunca ocultos; todo interativo com nome acessível); live regions — `aria-live` deve existir desde o carregamento, `polite` para atualizações de status, `assertive` reservado a erros críticos, cuidado para não sobrecarregar com várias regiões; `role="timer"`; `tabindex="0"`/`-1` e foco programático em mensagens de erro → §2.1, §2.4, §3.
- **a11y-specialist** — *WebAIM: Animation and Carousels*: conteúdo que se move por mais de 5 s precisa de forma de pausar (botão); `prefers-reduced-motion` para remover transições; animação prejudica pessoas com TDAH e deficiências cognitivas → §2.5.
- **a11y-specialist** — *WebAIM: Skip Navigation Links*: link de salto visível no foco, que move o foco para o conteúdo → §2.1 e §3.
- **a11y-specialist** — *Is Yelp Accessible? — Sighted Keyboard Testing*: elementos escondidos por `transform`/posicionamento continuam focáveis e quebram ordem e visibilidade do foco → remoção dos itens fora da viewport (§2.1) e `inert` no fundo do drawer.
- **asias-acessibilidade-web** — notas *1* (princípios POUR, 2.1.1 Teclado), *2* (nível AA como padrão de projetos comerciais; contraste 4,5:1; redimensionamento 200%), *3* (técnicas G18/G145 de contraste e falha F83 de texto sobre fundo com imagem/gradiente) e *16* (tamanho de alvo 24×24 px no AA do WCAG 2.2 e 44×44 px no AAA) → §2.6 e §3.
- **asias-ux-engineering** — *00 Skill*, "Ferramentas de apoio à medição": complementar o PR com `axe-core` e delegar critérios WCAG ao especialista de acessibilidade → §4.1.
