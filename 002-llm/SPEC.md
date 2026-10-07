# Spec do Produto — Bolha Venda (Sales Bubble)

**Versão:** 1.1 · **Data:** 06/10/2026 · **Status:** Rascunho para revisão (aprovação no Gate A)
**v1.1:** modelo da cota reservada (Pix) definido; tolerância de envio atrasado; tabela de score sem contradições; base da taxa = GMV concluído; caso de triagem e suspensão de conta especificados; questões Q7–Q10.
**Base:** [PRD v2.1](PRD.MD) · [Relatório de validação](002%20Docs/03-requisitos/validacao-prd.md) · [Plano de Projeto](002%20Docs/planing-project.md)

> **O que é este documento.** A Spec descreve **como o produto se comporta**: cada funcionalidade com suas regras exatas, fórmulas, estados, prazos, mensagens e casos de borda. O PRD diz *o quê e por quê*. A ERS (`002 Docs/03-requisitos/ers.md`) numera os requisitos e a arquitetura (`002 Docs/05-arquitetura/`) diz *como construir*. Em caso de conflito, vale a decisão mais recente registrada em ADR.
>
> Regras marcadas **(Proposto — ADR-xxxx)** aguardam aprovação no Gate A.

---

## 1. Modelo mental do produto

Uma **bolha** é uma oferta ou demanda coletiva com prazo. As pessoas entram com **cotas**; quanto mais cotas, menor o preço. Quando o tempo acaba ou as cotas lotam, a bolha **explode**:

- **Atingiu a meta mínima:** vira negócio fechado e segue para a **triagem** (pagamento → envio → recebimento → repasse).
- **Não atingiu:** todo mundo recebe 100% de volta.

Ao final, quem cumpriu o combinado ganha **score**.

```text
 ┌──────────────── Bolha de VENDA ────────────────┐   ┌──────────────── Bolha de COMPRA ───────────────┐
 │ Criador: vendedor (PJ, ou PF em C2C)           │   │ Criador: comprador organizador (PF ou PJ)      │
 │ Participantes: compradores                     │   │ Participantes: compradores                     │
 │ Preço: degraus definidos pelo vendedor         │   │ Preço: lances de empresas (≤ preço-alvo)       │
 │ Fecha no degrau atingido                       │   │ Fecha no lance escolhido                       │
 └────────────────────────────────────────────────┘   └────────────────────────────────────────────────┘
```

**Anatomia da bolha:**

| Campo | Significado |
| :--- | :--- |
| `max_quotas` | Capacidade — total de cotas |
| `min_quotas` | Meta mínima para a bolha ter sucesso (1 ≤ min ≤ max) |
| `filled_quotas` | Cotas ocupadas agora |
| `price_tiers` | Degraus `(a partir de N cotas → R$ por cota)` — só em bolhas de venda |
| `target_price` | Venda: último degrau. Compra: preço máximo aceitável por cota |
| `max_pj_share` | % máximo da capacidade que uma única PJ pode ocupar |
| `expires_at` | Fim da bolha (duração entre 1 h e 5 dias) |
| `shipping_days` | Prazo do vendedor para enviar após a captura (venda) |

---

## 2. Papéis e permissões

| Ação | Visitante | PF | PJ | Moderador |
| :--- | :---: | :---: | :---: | :---: |
| Navegar no canvas / ver detalhes públicos | ✅ | ✅ | ✅ | ✅ |
| Criar bolha de venda | — | ✅ (C2C)¹ | ✅ | — |
| Criar bolha de compra | — | ✅ | ✅ | — |
| Entrar em cota | — | 1 por bolha | até `max_pj_share` | — |
| Enviar lance em bolha de compra | — | — | ✅ (CNPJ ativo) | — |
| Escolher lance | — | criador | criador | — |
| Participar da própria bolha | — | ❌ | ❌ | — |
| Suspender bolha/conta, julgar contestação | — | — | — | ✅ |

¹ Uma PF vendedora (C2C) precisa ter um cadastro de recebedor aprovado no gateway antes de publicar, para poder receber os repasses.

O criador **não pode** entrar em cota nem dar lance na própria bolha (evita inflar a demanda artificialmente).

---

## 3. Funcionalidades

### F1 — Conta, identidade e privacidade

**Cadastro PF:**
1. Nome, e-mail, senha (ou Google), CPF e aceite dos termos e da política de privacidade (versões registradas).
2. CPF com dígito verificador válido e único na plataforma.
3. O sistema gera o pseudônimo (ex.: `Bolhista#4F2A`). O usuário pode trocar o apelido; o sufixo é fixo.

**Cadastro PJ:**
1. Os dados da PF responsável, mais o CNPJ.
2. Consulta ao provedor (BrasilAPI; fallback ReceitaWS) **(Proposto — ADR-0008)**:
   - **Situação ATIVA:** a conta é ativada e a razão social e o CNAE são preenchidos.
   - **Inativa, suspensa ou baixada:** cadastro bloqueado — "CNPJ com situação cadastral irregular".
   - **Provedor indisponível:** a conta fica `PENDING_VERIFICATION`. Pode navegar, mas não pode criar bolha, comprar cota nem dar lance. Nova tentativa automática a cada 15 min por 24 h.
3. Revalidação a cada 30 dias. Se o CNPJ ficar irregular, a conta não pode iniciar novas ações; as bolhas e triagens em andamento continuam.

**Sessão:** access token de 15 min e refresh token rotativo de 30 dias (cookie httpOnly). O logout revoga o refresh.

**Privacidade (LGPD):**
- No canvas e nos lances, aparece **apenas** o pseudônimo, nunca nome, documento ou e-mail.
- Na triagem, comprador e vendedor veem o nome e o endereço de entrega **só do próprio negócio**, e só a partir da captura.
- **Exportar meus dados:** JSON gerado em até 15 dias, com link para download.
- **Excluir conta:** bloqueada enquanto houver cota ativa ou triagem aberta. Depois disso, os dados pessoais são anonimizados. Os registros fiscais e transacionais ficam retidos pelo prazo legal.

### F2 — Canvas

**Navegação:**
- Desktop: arrastar com o mouse (pan) e roda/trackpad (zoom).
- Mobile: um dedo (pan) e pinça (zoom).
- Zoom entre 0,1× e 4×, com inércia no pan.

**Carregamento:** o cliente pede as bolhas da área visível (`bbox` + `zoom`) e assina as atualizações dos tiles visíveis. Ao mover a câmera, troca as assinaturas.

**Nível de detalhe (LOD):**

| Zoom | O que a bolha mostra |
| :--- | :--- |
| < 0,4× | Círculo colorido por tipo + anel de progresso |
| 0,4×–1× | + título curto, preço atual, tempo restante |
| > 1× | + meta, próximo degrau ("faltam 5 cotas para R$ 80"), flags e avatar pseudônimo do criador |

**Tamanho da bolha:** proporcional a `max_quotas`, em escala logarítmica e com limites mínimo e máximo.

**Posição:** definida pelo sistema na publicação, num espaço livre próximo ao cluster da categoria. O criador não escolhe (evita disputa de "terreno").

**Flags visuais:**
- `NEAR_FULL` (≥ 80% das cotas): ícone de "quase cheia" e borda âmbar.
- `EXPIRING` (< 1 h): contador em destaque e pulso.

Cores conforme o `style-guide.md`. Cada flag tem ícone e texto, **nunca só cor**.

**Bolhas encerradas:** ficam visíveis, esmaecidas, por 24 h após a explosão e depois saem do canvas.

**Lista acessível:** alternância "Canvas | Lista". A lista mostra as mesmas bolhas da área visível, ordenáveis por tempo restante, preço ou progresso, e é navegável por teclado. As atualizações são anunciadas por `aria-live` com throttling.

**Filtros:** tipo (venda/compra), categoria, faixa de preço, "só as que participo".

**Atualizações:** cada mudança de cota anima o anel e atualiza o preço. No máximo 1 atualização visual por bolha a cada 100 ms. Eventos fora de ordem (`version` menor que o atual) são descartados.

### F3 — Criar bolha de venda

Formulário em 4 passos:

1. **Produto:** título (5–80 caracteres), descrição (até 2.000), categoria, até 5 imagens.
2. **Cotas:**
   - `max_quotas`: 2–10.000.
   - `min_quotas`: 1–`max_quotas`; padrão 50% de `max_quotas`.
   - `max_pj_share`: 10–100%; padrão 50% **(Proposto — ADR-0006)**.
3. **Preço:** degraus **(Proposto — ADR-0004)**:
   - O primeiro degrau começa em 0 cotas (= preço inicial) e o último é o preço-alvo.
   - Entre 1 e 10 degraus; os limites de cotas são estritamente crescentes e os preços não crescentes.
   - Preço mínimo por cota: R$ 1,00. Valores em centavos.
   - Pré-visualização: gráfico "cotas × preço por cota".
4. **Prazos:**
   - Duração: 1 h a 5 dias.
   - `shipping_days`: 1–30; padrão 7.
   - Revisão final e publicação.

O rascunho (`DRAFT`) é salvo automaticamente e só o criador o vê. Publicar torna a bolha `ACTIVE`, define `starts_at = agora` e `expires_at`, e agenda os timers.

**Edição após publicar:** só a descrição e as imagens. Preço, cotas e prazo **não mudam**, porque a oferta é vinculante (CDC art. 30).

**Cancelamento pelo criador:** só com `filled_quotas = 0`.

### F4 — Criar bolha de compra

1. **Item desejado:** título, descrição/especificação, categoria, imagens de referência (opcional).
2. **Cotas:** `max_quotas`, `min_quotas`, `max_pj_share` (mesmas regras de F3).
3. **Preço-alvo:** preço máximo aceitável por cota. É o valor que cada participante autoriza.
4. **Fornecedores sugeridos:** até 5 CNPJs ou e-mails, convidados a dar lance.
5. **Duração:** 1 h a **4 dias**. Somada à janela de 24 h de seleção de lance, a pré-autorização nunca passa de 5 dias até a captura (R5).

O criador da bolha de compra **ocupa automaticamente 1 cota** — é o primeiro comprador. (Exceção à regra de "não participar da própria bolha": aqui o criador é comprador, não vendedor.) O pagamento dessa cota faz parte da publicação: só cartão, para não depender de reserva. Se não for autorizado, a publicação falha, a bolha continua em `DRAFT` e o criador vê "Não foi possível autorizar sua cota. A bolha não foi publicada". O criador fica com exatamente 1 cota, mesmo sendo PJ: não pode adquirir cotas adicionais (`CREATOR_CANNOT_JOIN`) nem sair da bolha, só cancelá-la enquanto for o único participante.

### F5 — Entrar e sair de cota

**Entrar:**
1. "Entrar na bolha" abre o resumo:
   - **Venda:** preço atual, degrau atingido, próximos degraus, meta, prazo de envio.
   - **Compra:** preço-alvo, lances recebidos até agora.
2. Escolher a quantidade (PF: fixa em 1; PJ: 1 até o limite disponível) e a forma de pagamento.
3. Confirmar:
   - **Cartão:** pré-autoriza `valor_reserva × quantidade`.
   - **Pix:** gera a cobrança, com prazo de pagamento `min(15 min, expires_at − agora)`. Pix não é oferecido quando faltam menos de 5 min para o fim da bolha. Durante o prazo, a cota fica **reservada** (veja abaixo).
   - `valor_reserva` = **preço inicial** (venda) ou **preço-alvo** (compra).
4. Pagamento autorizado → aquisição atômica da cota **(Proposto — ADR-0002)** → "Você está na bolha!".

**Cota reservada (Pix pendente):**
- **Ocupa capacidade:** a regra de lotação usa `filled_quotas + reserved_quotas ≤ max_quotas`. Ninguém toma uma vaga reservada.
- **Não conta para a meta nem para o preço:** só `filled_quotas` (cotas pagas) define o degrau e o sucesso.
- **Pix pago:** a reserva vira cota confirmada (`reserved → filled`) na mesma transação.
- **Pix não pago no prazo:** a reserva expira, a vaga volta a ficar livre, **sem penalidade de score**.
- **Explosão por lotação:** só ocorre com `filled_quotas = max_quotas`. Se as últimas vagas estiverem apenas reservadas, novas entradas recebem `QUOTA_SOLD_OUT` ("Cotas esgotadas — N reservas aguardando pagamento"). A bolha explode quando o último Pix é pago; se uma reserva expirar, a vaga reabre.
- **Fim do prazo com reservas pendentes:** as reservas são canceladas (o Pix pago depois disso é estornado automaticamente) e não contam para a meta.
- **Proteção contra abuso:** reservas expiradas não afetam o score, mas cada conta pode ter no máximo 3 reservas Pix abertas ao mesmo tempo. Com 3 reservas expiradas em 24 h, o Pix fica indisponível para a conta por 24 h (cartão continua liberado). Mensagem: "Você deixou reservas expirarem recentemente. Pix volta a ficar disponível em HH:MM; use cartão para entrar agora."

**Regras de recusa:**

| Situação | Código | Mensagem ao usuário |
| :--- | :--- | :--- |
| Sem cotas livres | `QUOTA_SOLD_OUT` | "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado." |
| PF já tem cota | `PF_QUOTA_LIMIT` | "Você já participa desta bolha (limite de 1 cota por pessoa)." |
| PJ ultrapassaria o teto | `PJ_SHARE_EXCEEDED` | "Sua empresa pode ocupar no máximo N cotas nesta bolha." |
| Bolha não está ativa | `BUBBLE_NOT_ACTIVE` | "Esta bolha já foi encerrada." |
| Criador tentando participar | `CREATOR_CANNOT_JOIN` | "Você não pode participar da própria bolha." |
| Pagamento recusado | `PAYMENT_DECLINED` | "O pagamento não foi autorizado. Tente outra forma de pagamento." |
| Conta PJ não verificada | `ACCOUNT_NOT_VERIFIED` | "Conclua a verificação do CNPJ para participar." |

Em qualquer recusa depois da autorização, a pré-autorização é cancelada (ou o Pix estornado) automaticamente.

**Idempotência:** clicar duas vezes ou repetir a requisição com a mesma `Idempotency-Key` nunca gera duas cotas nem duas cobranças.

**Sair:** "Sair da bolha" fica disponível enquanto `ACTIVE` e fora da última hora. A saída libera a pré-autorização (ou estorna o Pix integralmente) e recalcula o preço para todos. Na última hora, o botão aparece desabilitado com a explicação "Saídas são bloqueadas na última hora para proteger o grupo".

### F6 — Preço (bolha de venda)

**Regra (Proposto — ADR-0004):**
`preço_atual = unit_price do maior degrau cujo min_filled_quotas ≤ filled_quotas`.
O **preço final** é o `preço_atual` no momento da explosão e é **igual para todos**, inclusive para quem entrou primeiro.

**Exemplo:**
- Capacidade 100, meta 40.
- Degraus: 0 → R$ 100 · 40 → R$ 90 · 70 → R$ 80 · 100 → R$ 75.
- Cada comprador pré-autoriza R$ 100.

| Cotas na explosão | Resultado | Preço final | Cada comprador paga |
| :--- | :--- | :--- | :--- |
| 35 (tempo acabou) | `EXPIRED_FAILED` | — | R$ 0 (estorno total) |
| 72 (tempo acabou) | `EXPIRED_SUCCESS` | R$ 80 | R$ 80 (R$ 20 liberados) |
| 100 (lotou) | `EXPIRED_SUCCESS` | R$ 75 | R$ 75 (R$ 25 liberados) |

**Taxa da plataforma (hipótese):** 6% sobre o valor dos itens de triagem `COMPLETED` (GMV concluído, já descontados estornos e arrependimentos). É retida no repasse ao vendedor. Os compradores não pagam taxa.

### F7 — Explosão e timers

| Gatilho | Condição | Resultado |
| :--- | :--- | :--- |
| Última cota preenchida | `filled_quotas = max_quotas` | `EXPIRED_SUCCESS` (motivo `FULL`), na mesma transação da cota |
| Fim do prazo | `filled_quotas ≥ min_quotas` | `EXPIRED_SUCCESS` (motivo `TIME`) |
| Fim do prazo | `filled_quotas < min_quotas` | `EXPIRED_FAILED` → estorno de 100% → `CANCELLED` |

- **Pontualidade:** a explosão por tempo acontece em ≤ 2 s após `expires_at`.
  - **Queda de worker:** os workers rodam com no mínimo 2 réplicas. Se uma cair, a outra assume o job (o lock do BullMQ expira e o job é reprocessado), mantendo a meta.
  - **Perda do job (falha do Redis):** o reconciliador (a cada 1 min) encontra a bolha vencida e a explode. Esse caminho é de contingência: viola a meta de 2 s e dispara alerta.
  - **Idempotência:** explodir duas vezes não tem efeito **(Proposto — ADR-0011)**.
- **Aviso de `EXPIRING`:** 1 h antes do fim, notificação aos participantes e ao criador.
- **Animação:** a explosão aparece em tempo real para todos que veem a bolha. Com `prefers-reduced-motion`, é substituída por um fade.

**Pós-explosão com sucesso:**
- **Venda:** captura imediata do preço final de todos os participantes. As capturas que falharem (ex.: pré-autorização expirada) viram itens cancelados, sem afetar os demais. Em seguida, abre a triagem.
- **Compra:** abre a seleção de lance (F8). A captura ocorre após a seleção.

### F8 — Lances (bolha de compra)

**Enviar (PJ verificada):**
- Preço por cota (≤ preço-alvo), prazo de entrega em dias, condições (texto até 1.000 caracteres). O lance é vinculante até o fim da janela de seleção (24 h após a explosão) ou até ser retirado/substituído enquanto a bolha está `ACTIVE`.
- Um lance ativo por empresa por bolha; a empresa pode substituí-lo (o anterior vira `WITHDRAWN`).
- Lance acima do preço-alvo: `BID_ABOVE_TARGET` — "O lance precisa ser igual ou menor que o preço-alvo de R$ X".

**Visibilidade:** durante `ACTIVE`, todos veem os lances (preço, prazo, score da empresa), com a empresa identificada por pseudônimo.

**Seleção (Proposto — ADR-0005):**
1. Na explosão com sucesso, o criador tem **24 h** para escolher um lance.
2. Sem escolha, o sistema seleciona o **menor preço** (empate: o lance mais antigo).
3. Sem nenhum lance válido, a bolha vai para `CANCELLED`, com estorno de 100%.
4. Após a seleção:
   - o nome da empresa vencedora é revelado aos participantes;
   - captura do preço do lance de cada participante (a diferença para o preço-alvo é liberada);
   - abre a triagem, com a empresa como vendedora.

### F9 — Triagem

Cada participante tem um **item de triagem** (1 por cota ou grupo de cotas de uma conta).

```text
PENDING_SHIPMENT ──(vendedor informa rastreio)──► SHIPPED ──(comprador confirma ou auto 7 d)──► DELIVERED
      │ shipping_days esgotado                                                                      │
      ▼                                                                 janela de arrependimento 7 d │
 PENDING_SHIPMENT [atrasado] ──(envio na tolerância, −15)──► SHIPPED                                ▼
      │ +3 dias de tolerância esgotados            WITHDRAWAL_REQUESTED ◄──(comprador desiste)── [janela]
      ▼                                                    │ devolução confirmada                   │ janela encerrada
 CANCELLED (estorno 100%, vendedor −60)                    ▼                                        ▼
                                                   CANCELLED (estorno)                      COMPLETED (repasse liberado)
```

| Etapa | Quem age | Prazo | Se não agir |
| :--- | :--- | :--- | :--- |
| Registrar envio (código de rastreio) | Vendedor | `shipping_days` após a captura | Item marcado **atrasado**; o comprador é avisado e pode cancelar com estorno 100% a qualquer momento |
| Envio atrasado (tolerância) | Vendedor | +3 dias após `shipping_days` | Item cancelado, estorno 100%, vendedor −60. Se o envio ocorrer dentro da tolerância: vendedor −15 (em vez de +5) |
| Confirmar recebimento | Comprador | — | Confirmação automática 7 dias após a entrega rastreada (ou após o prazo estimado de entrega) |
| Arrependimento (CDC art. 49) | Comprador | 7 dias após o recebimento | Janela encerra → `COMPLETED` |
| Devolução após arrependimento | Comprador envia, vendedor confirma | 10 dias | Moderação decide |
| Repasse ao vendedor | Sistema | Ao `COMPLETED` | — |

- **Bolha:** `COMPLETED` quando todos os itens estão finalizados e ao menos 1 foi concluído; `CANCELLED` se todos forem cancelados.
- **Caso de triagem (problema com o item):** o comprador pode abrir um caso ("Não recebi", "Produto diferente", "Produto com defeito") com o item em `SHIPPED` ou `DELIVERED`, até o fim da janela de arrependimento. O caso pausa os prazos automáticos e o repasse e vai para a moderação. A decisão pode ser:
  - **Estorno total:** item `CANCELLED`.
  - **Estorno parcial:** item `COMPLETED`, com o valor capturado reduzido. A taxa e o score de "transação concluída" usam o valor final.
  - **Improcedente:** o item retoma os prazos de onde parou.
- **Cancelamento pelo comprador durante o atraso:** item `CANCELLED`, estorno 100%, vendedor −60 (mesmo efeito do fim da tolerância).

### F10 — Score de reputação

**Regra (Proposto — ADR-0007):** escala 0–1000; toda conta começa em 500.

| Evento | Quem | Pontos |
| :--- | :--- | :--- |
| Transação concluída (item `COMPLETED`) | Comprador / Vendedor | +20 / +30 |
| Envio dentro do prazo | Vendedor | +5 |
| Envio atrasado (dentro da tolerância de 3 dias) | Vendedor | −15 |
| Item cancelado por não envio (fim da tolerância ou cancelamento pelo comprador durante o atraso) | Vendedor | −60 |
| Chargeback aberto pelo comprador após `COMPLETED`, julgado improcedente | Comprador | −40 |
| Caso de triagem julgado procedente contra o vendedor | Vendedor | −30 |
| Contestação julgada procedente | Afetado | reverte o evento |

Não geram penalidade: reserva Pix expirada, saída de cota, arrependimento (direito legal) e falha de captura por pré-autorização expirada.

- **Cálculo:** `score = clamp(0, 1000, 500 + Σ pontos × 0,5^(idade_em_dias / 180))` — eventos antigos pesam menos.
- **Faixas:** 0–299 Risco · 300–599 Regular · 600–799 Bom · 800–1000 Excelente. A faixa aparece junto ao pseudônimo.
- **Transparência:** a tela "Meu score" lista cada evento, com data, pontos, motivo e versão do modelo.
- **Contestação:**
  1. Até **5 dias** após o evento, com justificativa e anexos.
  2. O evento fica "em revisão" e não conta no score até a decisão.
  3. O moderador decide em até 5 dias úteis.
  4. Decisão e motivo ficam registrados e o usuário é notificado.
  5. No R1, a decisão é final na plataforma (sem segunda instância). Um moderador diferente do que gerou o caso original julga a contestação.
- **Uso no produto (R1):** apenas informativo. Nenhum bloqueio automático por score no R1. A partir do R2, poderá restringir bolhas de alto valor.

### F11 — Notificações

| Evento | Destinatários | Canal |
| :--- | :--- | :--- |
| Cota confirmada / liberada | Participante | in-app |
| Mudou de degrau | Participantes | in-app |
| Bolha `EXPIRING` | Participantes e criador | in-app + e-mail |
| Explosão (sucesso ou falha) | Participantes e criador | in-app + e-mail |
| Novo lance | Criador da bolha de compra | in-app |
| Prazo de seleção de lance (aviso em T−2 h) | Criador | in-app + e-mail |
| Lance selecionado / não selecionado | Empresas que deram lance | in-app + e-mail |
| Prazos de triagem (aviso 24 h antes) | Quem precisa agir | in-app + e-mail |
| Estorno realizado | Comprador | in-app + e-mail |
| Mudança de score / decisão de contestação | Titular | in-app |
| Convite de fornecedor sugerido | Empresa sugerida | e-mail |

O usuário pode desligar os e-mails não transacionais. Os transacionais (cobrança, estorno, prazos) não podem ser desligados.

### F12 — Moderação

- **Fila de moderação:** bolhas denunciadas, casos de triagem e contestações de score.
- **Ações:** suspender bolha (estorno de 100% de tudo), suspender conta, decidir contestação, decidir caso de triagem (estorno total ou parcial, ou liberar o repasse).
- Toda ação exige motivo e gera um registro imutável na trilha de auditoria.
- **Denúncia:** qualquer usuário logado pode denunciar uma bolha (categorias: proibido, enganoso, fraude, outro).

---

## 4. Máquina de estados da bolha

Estados `DRAFT`, `ACTIVE`, `EXPIRED_SUCCESS`, `EXPIRED_FAILED`, `IN_TRIAGE`, `COMPLETED` e `CANCELLED` — diagrama e transições no [PRD §8.1](PRD.MD) e em `002 Docs/05-arquitetura/maquina-estados.md` **(Proposto — ADR-0009)**. `NEAR_FULL` e `EXPIRING` são flags, não estados.

---

## 5. Parâmetros do produto

Valores padrão do R1. Alterá-los é decisão do PO e exige registro.

| Parâmetro | Valor | Configurável por |
| :--- | :--- | :--- |
| Cotas por PF por bolha | 1 | fixo |
| `max_pj_share` | 50% (10–100%); teto em cotas = `max(1, ⌊max_pj_share × max_quotas⌋)` | criador |
| Reservas Pix simultâneas por conta | 3 (em bolhas diferentes) | plataforma |
| Bloqueio de Pix por abuso | 3 reservas expiradas em 24 h → Pix indisponível por 24 h (só cartão) | plataforma |
| Duração da bolha | Venda: 1 h – 5 dias · Compra: 1 h – 4 dias | criador |
| Limite da flag `NEAR_FULL` | ≥ 80% de `max_quotas` | plataforma |
| Limite da flag `EXPIRING` / bloqueio de saída | últimos 60 min | plataforma |
| Tempo de reserva do Pix | `min(15 min, tempo restante)`; sem Pix nos últimos 5 min | plataforma |
| Tolerância de envio atrasado | +3 dias após `shipping_days` | plataforma |
| Janela de seleção de lance | 24 h | plataforma |
| `shipping_days` | 7 (1–30) | criador |
| Confirmação automática de recebimento | 7 dias após a entrega | plataforma |
| Janela de arrependimento | 7 dias após o recebimento | lei (fixo) |
| Prazo de contestação de score | 5 dias | plataforma |
| Score inicial / meia-vida | 500 / 180 dias | plataforma (versionado) |
| Revalidação de CNPJ | 30 dias | plataforma |
| Taxa da plataforma | 6% do GMV de itens `COMPLETED`, retida no repasse (hipótese) | negócio |
| Bolhas encerradas visíveis no canvas | 24 h | plataforma |
| Atualização visual máxima por bolha | 1 a cada 100 ms | plataforma |

---

## 6. Casos de borda (comportamento esperado)

| Situação | Comportamento |
| :--- | :--- |
| 100 pessoas tentam a última cota ao mesmo tempo | Exatamente 1 consegue; 99 recebem `QUOTA_SOLD_OUT` sem cobrança |
| PF abre duas abas e confirma nas duas | 1 cota; a segunda recebe `PF_QUOTA_LIMIT` (ou a mesma resposta, se for a mesma `Idempotency-Key`) |
| PJ compra 100% de uma vez (dentro do teto de 100%) | `ACTIVE → EXPIRED_SUCCESS` direto, na mesma transação |
| Cota liberada na mesma hora em que outra é comprada | As duas operações são atômicas; o preço reflete o estado final |
| Pix reservado não pago em 15 min | Reserva liberada, a cota volta a ficar disponível, sem penalidade de score |
| Bolha explode com um Pix ainda pendente | A reserva é cancelada e não conta para a meta; se a meta só seria atingida com ela, a bolha falha. Pix pago após o fim é estornado automaticamente |
| Últimas vagas só reservadas (Pix pendente) | Novas entradas recebem `QUOTA_SOLD_OUT`; a explosão por lotação ocorre quando o último Pix é pago; reserva expirada reabre a vaga |
| Worker do timer cai no momento da explosão | Outra réplica reprocessa o job; a explosão ainda ocorre em ≤ 2 s |
| Redis perde os jobs agendados | O reconciliador explode as bolhas vencidas em ≤ 1 min; a violação da meta de 2 s dispara alerta |
| Webhook de captura chega duas vezes | Processado uma vez (idempotência pelo ID do evento do gateway) |
| Pré-autorização expirou antes da captura | O item daquele comprador é cancelado; o score do comprador não é afetado; os demais seguem |
| Criador da bolha de compra não escolhe lance | Vence o menor lance após 24 h |
| Vendedor não envia no prazo | Item marcado atrasado; envio em até +3 dias → vendedor −15; após isso (ou se o comprador cancelar no atraso) → item cancelado, estorno total, vendedor −60 |
| Conta suspensa pela moderação | Bolhas `ACTIVE` criadas por ela são canceladas com estorno 100%; suas cotas em bolhas ativas são liberadas; triagens em andamento seguem com a moderação acompanhando, e o repasse fica retido até a revisão |
| Comprador se arrepende após receber | `WITHDRAWAL_REQUESTED` → devolução → estorno; sem penalidade para o comprador |
| Usuário pede exclusão com triagem aberta | Bloqueado, com a explicação; disponível após o encerramento |
| CNPJ fica irregular com bolha ativa | A bolha segue até o fim; a conta não cria novas bolhas nem dá lances |
| Cliente reconecta após queda de rede | Recarrega o snapshot das bolhas visíveis e descarta eventos com `version` antiga |

---

## 7. Fora de escopo do R1

Processamento financeiro próprio, app nativo, ERP/WMS, frete integrado, chat livre entre as partes, bloqueio automático por score, programa de indicação e múltiplas moedas. Detalhes no [PRD §9](PRD.MD).

---

## 8. Critérios de aceite da Release 1.0

1. Todos os fluxos F1–F12 funcionam de ponta a ponta em staging, com o gateway em sandbox.
2. Os casos de borda da seção 6 têm testes automatizados verdes.
3. As metas técnicas do PRD §10 são comprovadas em teste de carga: canvas a 60 FPS com 500 bolhas, tempo real com p99 < 200 ms e explosão com p99 ≤ 2 s.
4. O canvas e a lista acessível passam na auditoria WCAG 2.1 AA (axe-core sem violações sérias + teste manual com leitor de tela).
5. Checklist LGPD concluído: inventário de dados, RIPD, fluxos de exportação e exclusão, plano de incidente.
6. Beta fechado (≈ 50 usuários, 5 PJs) sem bug S1 aberto.

---

## 9. Questões em aberto (decidir até o Gate A)

| # | Questão | Recomendação desta Spec |
| :--- | :--- | :--- |
| Q1 | Validade real da pré-autorização no gateway escolhido | Confirmar com a Pagar.me; se < 5 dias, reduzir a duração máxima |
| Q2 | A PF vendedora (C2C) entra no R1? Exige KYC de recebedor | Manter, condicionado ao cadastro de recebedor |
| Q3 | Política de categorias proibidas (ex.: medicamentos, armas, bens digitais) | Lista fechada nos Termos de Uso, com revisão jurídica |
| Q4 | O score deve restringir participação no R1? | Não; só informativo |
| Q5 | Taxa de 6% e quem a paga | Validar com entrevistas de PJs no S0 |
| Q6 | Frete: incluso no preço da cota ou à parte? | Incluso no preço da cota no R1 (simplicidade) |
| Q7 ⚖️ | Arrependimento de 7 dias em C2C e B2B, onde o CDC pode não se aplicar | Aplicar a regra a todas as modalidades no R1 (uniformidade) até parecer jurídico |
| Q8 ⚖️ | Quem paga o frete da devolução no arrependimento | Vendedor, por analogia ao CDC art. 49; confirmar com advogado |
| Q9 | Quem absorve a tarifa do Pix e do gateway quando a bolha falha e tudo é estornado | Plataforma (custo de aquisição); medir na hipótese H8 do business case |
| Q10 | Nota fiscal sobre a taxa da plataforma | Emitida pela plataforma ao vendedor, mensalmente; validar com a contabilidade |

---

## Fontes consultadas (AlterEgo)

- `requirements-engineer`: Roger S. Pressman, *Engenharia de Software* (7. ed.), p. 129–130 — critérios de validação (requisito quantificado e testável) aplicados aos parâmetros e casos de borda.
- `asias-postgresql`: *PostgreSQL 17 Docs* §13.3–13.4 — atomicidade da cota (F5, seção 6).
- `asias-scrum`: Rafael Sabbagh, *Scrum — Gestão ágil para projetos de sucesso* — Meta de Release e critérios de aceite (seção 8).
- `juridico-contratos`: LGPD — pseudonimização × anonimização, bases legais e direitos do titular (F1).
- `kg_recommend_specialists`: squads e papéis por fase do manual de processo.
