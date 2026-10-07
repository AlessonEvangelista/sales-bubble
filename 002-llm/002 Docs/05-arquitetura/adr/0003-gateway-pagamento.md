# ADR-0003 — Gateway Pagar.me v5 atrás de `PaymentGatewayPort`; pré-autorização/captura, Pix com estorno, webhooks idempotentes

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF07](../../../PRD.MD) · [Spec v1.1 F5–F9](../../../SPEC.md) · decisão do plano: **D2** · ADRs relacionados: ADR-0002, ADR-0004, ADR-0005, ADR-0010
**Decisores:** PO, Tech Lead, Jurídico · **Revisar em:** fim do spike de sandbox (S0) — validade da pré-autorização e autenticação de webhook

## Contexto

- O PRD exige estorno de 100% em bolhas que falham e cobrança do **preço final único**. Sem gateway não há pré-reserva (o `mvp.md` previa liquidação manual).
- **Cartão:** pré-autorizar `valor_reserva × cotas` na adesão e capturar parcialmente o preço final na explosão. **Pix:** cobrar o `valor_reserva` (reserva de 15 min, Spec F5) e estornar a diferença na explosão (ou tudo, se falhar).
- Repasse ao vendedor só após a janela de arrependimento (7 dias após o recebimento), com taxa de 6% retida sobre os itens `COMPLETED` (Spec v1.1, hipótese de negócio).
- Riscos: R4 (atraso de homologação do gateway, caminho crítico do plano) e R5 (pré-autorização expira antes da bolha encerrar → duração máxima de 5 dias, a confirmar).

## Decisão

1. **Pagar.me v5** como gateway do R1, sempre atrás de uma porta de domínio:

```ts
export interface PaymentGatewayPort {
  authorizeCard(i: { amount: Cents; cardToken: string; idempotencyKey: string; customerRef: string }): Promise<AuthResult>;
  createPixCharge(i: { amount: Cents; expiresInSec: number; idempotencyKey: string }): Promise<PixCharge>; // QR + charge id
  capture(i: { chargeId: string; amount: Cents; idempotencyKey: string }): Promise<CaptureResult>;          // cartão: captura parcial
  settlePix(i: { chargeId: string; finalAmount: Cents; idempotencyKey: string }): Promise<CaptureResult>;   // Pix: estorna a diferença
  void(i: { chargeId: string; idempotencyKey: string }): Promise<void>;                                     // cartão: cancela; Pix: estorno integral
  refund(i: { chargeId: string; amount: Cents; idempotencyKey: string }): Promise<RefundResult>;
  releasePayout(i: { recipientId: string; amount: Cents; idempotencyKey: string }): Promise<PayoutResult>;
  getCharge(chargeId: string): Promise<ChargeSnapshot>;                                                     // fetch-back
}
```

   Adapters: `PagarmeV5Adapter` (produção), `FakePaymentGatewayAdapter` (dev/testes, determinístico) e, no futuro, `StripeAdapter`. Uma suíte de **testes de contrato** roda contra o fake e contra o sandbox.
2. **Toda chamada carrega chave de idempotência derivada do domínio** (`pay__{paymentId}`, `capture__{paymentId}`, `void__{paymentId}`, `refund__{paymentId}__{reason}`, `payout__{payoutId}`). Retries nunca duplicam movimentação.
3. **Nenhuma chamada ao gateway dentro de transação de banco.** Autoriza antes da transação da cota; anula depois do `ROLLBACK`; capturas e estornos rodam em consumidores do outbox (ADR-0010).
4. **Webhooks:** `POST /api/v1/webhooks/payments/pagarme` → verificação da assinatura (HMAC, comparação *timing-safe*) → `INSERT webhook_events ON CONFLICT (provider, provider_event_id) DO NOTHING` → 200 imediato → processamento assíncrono com **fetch-back** (`getCharge`) e transição condicional (`UPDATE payments … WHERE status = :esperado`). Ver [eventos-dominio.md §6.4](../eventos-dominio.md#64-webhook-de-captura-duplicado).
5. **Repasse:** cada vendedor (PJ, ou PF C2C com recebedor aprovado — Spec §2) tem `gateway_recipient_id`. O repasse por item é liberado em `TriageItemCompleted` com `net = final_amount − 6% − taxa do gateway`; fica retido com `payout_on_hold` (caso de triagem aberto ou vendedor suspenso).
6. **Conciliação diária** gateway × `payments`/`refunds`/`payouts` (fila `maintenance`) e reconciliação de pagamentos "parados" no reconciliador (R8).

## Alternativas consideradas

| Critério | **A. Pagar.me v5 + porta (escolhida)** | B. Stripe | C. Liquidação manual (MVP original) | D. Mercado Pago |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●● taxas de mercado BR; Pix nativo | ●● Pix no Brasil com mais restrições; preço em USD em parte dos serviços | ●●● sem taxa de gateway, mas custo operacional alto | ●● |
| Reversibilidade | ●●● porta isola o provedor | ●●● (mesma porta) | ● sem pré-reserva, não atende o PRD | ●●● (mesma porta) |
| Complexidade | ●● split/recebedor + webhooks | ●● Connect é mais complexo para recebedores PF | ●●● | ●● |
| Risco | ●● validade da pré-autorização (R5) e homologação (R4) a confirmar | ●● onboarding de recebedores BR | ● viola o PRD §4.1 (estorno de "valores pré-reservados") e o CDC operacionalmente | ●● |

Stripe permanece como alternativa pronta para troca (mesma porta). A escolha final depende do spike do S0 (validade da pré-autorização, captura parcial, Pix com estorno parcial, recebedores PF, autenticação de webhook).

## Consequências

**Positivas (+)**
- Fluxo único para cartão e Pix no domínio (`authorize → capture/settle | void → refund`).
- Idempotência ponta a ponta: retries, webhooks repetidos e crashes não duplicam dinheiro.
- Troca de provedor restrita a `payment/infrastructure`.

**Negativas (−)**
- Duração máxima da bolha (5 dias) amarrada à validade da pré-autorização → se o sandbox mostrar menos, reduzir o máximo (Spec Q1).
- Pix "pago e depois estornado" tem custo e atrito → aviso no checkout; Pix indisponível nos últimos 5 min; anti-abuso de reservas (Spec F5).
- **Em aberto:** se o Pagar.me v5 não assinar webhooks com HMAC, usar *basic auth* + allowlist de IP, com o *fetch-back* como garantia principal.
- Retenção do repasse por até ~7 dias + prazo de entrega: validar com o comercial do gateway e o Jurídico (custódia de valores).

## Verificação

- Testes de contrato da porta (fake e sandbox): captura parcial, estorno parcial do Pix, void, refund, idempotência por chave.
- CT: bolha que falha → 100% estornado, conciliação batendo (plano §9); webhook duplicado → 1 transição.

## Fontes

- Projeto: PRD v2.1 §4.1, §9, RF07; Spec v1.1 F5, F6, F9, §5; plano v2 §6 (D2), §7 (R4, R5).
- **asias-arquitetura-hexagonal** — *Skill*: portas nomeadas pela necessidade do negócio e adapters substituíveis por tecnologia (base da `PaymentGatewayPort` e do adapter fake).
- **asias-dist-data-systems** — *Apache Kafka Docs*, "Message Delivery Semantics": entrega *at-least-once* e o cuidado com promessas de *exactly-once* → idempotência por chave em toda chamada e em todo webhook.
