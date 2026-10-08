# ADR-0002 — Concorrência na aquisição de cotas: `UPDATE` condicional em Read Committed + índice único parcial

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 §5.2 e §8.2](../../../PRD.MD) · [Spec v1.1 F5 e §6](../../../SPEC.md) · decisão do plano: **D1** · ADRs relacionados: ADR-0006, ADR-0009, ADR-0011
**Decisores:** Tech Lead · **Revisar em:** se o teste de carga mostrar contenção na linha da bolha acima de 500 cotas/s numa única bolha

## Contexto

- **RNF02:** a compra da última cota é estritamente atômica; 100 requisições simultâneas por 1 cota → exatamente 1 sucesso. PF tem no máximo 1 cota por bolha, inclusive com duas abas (Spec §6).
- As fontes anteriores eram contraditórias: o PRD v2.0 citava Redlock **e** `SELECT FOR UPDATE`; `tecnologias.md` citava `SERIALIZABLE`; `arquitetura.md` citava as duas. O PRD v2.1 já adota o `UPDATE` condicional sem lock distribuído.
- Spec v1.1 F5: a reserva Pix (`RESERVED`) **ocupa capacidade** mas **não conta** para meta, preço nem lotação. A explosão por lotação ocorre na mesma transação da última cota **paga** (D8).
- O caminho é quente: numa bolha concorrida, todas as aquisições disputam a mesma linha de `bubbles`.

## Decisão

### 1. Guarda de capacidade num único `UPDATE` condicional (isolamento padrão Read Committed)

Fato canônico (D1):

```sql
UPDATE bubbles SET filled_quotas = filled_quotas + :n
 WHERE id = :id AND status = 'ACTIVE' AND filled_quotas + :n <= max_quotas;
```

Forma adotada, ajustada à Spec v1.1 (reserva Pix) e à guarda de tempo do ADR-0011:

```sql
-- Cartão (cota nasce ACTIVE) — pode explodir por lotação na mesma instrução
UPDATE bubbles
   SET filled_quotas  = filled_quotas + :n,
       status         = CASE WHEN filled_quotas + :n = max_quotas THEN 'EXPIRED_SUCCESS' ELSE status END,
       exploded_at    = CASE WHEN filled_quotas + :n = max_quotas THEN now() ELSE exploded_at END,
       explode_reason = CASE WHEN filled_quotas + :n = max_quotas THEN 'FULL' ELSE explode_reason END,
       version        = version + 1,
       updated_at     = now()
 WHERE id = :id
   AND status = 'ACTIVE'
   AND creator_id <> :account_id                        -- SALE: CREATOR_CANNOT_JOIN
   AND filled_quotas + reserved_quotas + :n <= max_quotas  -- reservas Pix ocupam capacidade
   AND expires_at > now()                               -- nenhuma cota após o fim, mesmo com timer atrasado
RETURNING filled_quotas, reserved_quotas, max_quotas, status, version;

-- Pix (reserva): incrementa reserved_quotas com a mesma guarda de capacidade
-- Pix pago: move reserved → filled e pode explodir por lotação (filled = max)
```

As três variantes completas (cartão, reserva Pix, confirmação Pix) estão em [modelo-dados.md §4.1](../modelo-dados.md#41-aquisição-de-cota-caminho-quente--adr-0002). Na mesma transação: `INSERT quotas`, preço final (se explodiu) e `INSERT outbox_events` (`QuotaAcquired` [, `BubbleExploded`]).

**Por que é correto em Read Committed:** o `UPDATE` trava a linha. Uma segunda transação concorrente espera o commit da primeira e então **reavalia o `WHERE` sobre a versão nova da linha** (comportamento documentado do PostgreSQL). Se `filled + reserved + n` passou de `max_quotas`, ela atualiza 0 linhas. Não há janela entre "ler" e "escrever": a leitura e a escrita são a mesma instrução.

### 2. Unicidade PF garantida pelo banco

```sql
CREATE UNIQUE INDEX quotas_pf_one_per_bubble_uk ON quotas (bubble_id, account_id)
    WHERE account_type = 'PF' AND status IN ('RESERVED','ACTIVE');
```

O fato canônico usa `status = 'ACTIVE'`. A Spec v1.1 exige que a reserva Pix também conte, então `RESERVED` entra no predicado. Duas abas do mesmo PF: a segunda transação bloqueia no índice até a primeira terminar e recebe `23505 unique_violation`.

### 3. Tratamento de `rows_affected = 0` e de `23505` → 409

```ts
// bubble/application/acquire-quota.use-case.ts (trecho)
const row = await trx.$queryRaw<Row[]>`UPDATE bubbles ... RETURNING ...`;
if (row.length === 0) {
  // diagnóstico sem lock, só para escolher a mensagem (o estado pode ter mudado; tudo bem)
  const b = await trx.bubble.findUnique({ where: { id }, select: { status: true, expiresAt: true,
            filledQuotas: true, reservedQuotas: true, maxQuotas: true, creatorId: true } });
  const code =
      b.creatorId === accountId                    ? 'CREATOR_CANNOT_JOIN'
    : b.status !== 'ACTIVE' || b.expiresAt <= now ? 'BUBBLE_NOT_ACTIVE'
    :                                               'QUOTA_SOLD_OUT';
  throw new ConflictProblem(code, { reserved: b.reservedQuotas });   // → ROLLBACK
}
try { await trx.quota.create({ data: quota }); }
catch (e) { if (isUniqueViolation(e, 'quotas_pf_one_per_bubble_uk')) throw new ConflictProblem('PF_QUOTA_LIMIT'); throw e; }
```

Resposta (RFC 9457):

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{ "type": "https://bolhavenda.com.br/problems/quota-sold-out",
  "title": "Cotas esgotadas",
  "status": 409,
  "code": "QUOTA_SOLD_OUT",
  "detail": "As cotas acabaram enquanto você confirmava. Nenhum valor foi cobrado.",
  "reserved_pending": 2,
  "instance": "/api/v1/bubbles/0192…/quotas",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736" }
```

Depois do `ROLLBACK`, a pré-autorização do cartão é anulada (`void`, chave de idempotência `void__{paymentId}`). A resposta 409 é gravada em `idempotency_keys`: repetir com a mesma `Idempotency-Key` devolve o mesmo 409, sem nova autorização.

### 4. Ordem das instruções e duração do lock

A ordem `UPDATE bubbles` → `INSERT quotas` → `INSERT outbox` segue o PRD v2.1 §8.2. O lock da linha da bolha dura do `UPDATE` ao `COMMIT` (~1–3 ms). **Nenhuma chamada externa** (gateway) acontece dentro dessa transação: a autorização é feita antes e a anulação depois. Teto PJ: ver ADR-0006 (*advisory lock* por bolha + conta, antes do `UPDATE`).

### 5. Sem Redlock, sem `SERIALIZABLE`, sem `SELECT … FOR UPDATE`

## Alternativas consideradas

| Critério | **A. `UPDATE` condicional + índice parcial (escolhida)** | B. Redlock (Redis) + `UPDATE` | C. `SERIALIZABLE` + retry | D. `SELECT … FOR UPDATE` + `UPDATE` |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● 1 instrução, sem infraestrutura extra | ● Redis no caminho crítico; 2–3 idas extras ao Redis por cota | ●● retry em toda transação de escrita | ●● 2 idas ao banco |
| Reversibilidade | ●●● trocar depois é local ao repositório | ●● | ●● | ●●● |
| Complexidade | ●●● | ● lease, TTL, renovação, falha parcial | ● tratar `40001` em todo lugar, *backoff* | ●● |
| Risco | ●●● correção garantida pelo banco | ● lock expira (pausa de GC, rede) e dois processos "têm" o lock; failover assíncrono do Redis perde locks | ●● tempestade de aborts sob contenção na última cota | ●● lock mantido por mais tempo; esquecer o `FOR UPDATE` num caminho reintroduz a corrida |

**Por que Redlock foi descartado.** (i) É **redundante**: o Postgres já serializa as escritas na linha da bolha, que é a fonte da verdade, e o lock no Redis não protege nada que o `UPDATE` condicional não proteja. (ii) **Não é seguro sozinho:** um lock distribuído com *lease* pode expirar enquanto o detentor ainda trabalha (pausa de GC, latência), e sem um *fencing token* verificado pelo armazenamento, dois processos escrevem. Com o Postgres validando a condição no `WHERE`, o lock vira só custo. (iii) Põe o Redis, que é infraestrutura de filas e pub/sub sem a durabilidade de um banco, no caminho de corretude financeira. (iv) Soma latência (aquisição, liberação, retries) num fluxo com orçamento de 200 ms.

**Por que `SERIALIZABLE` foi descartado.** Ele não acrescenta garantia a uma regra expressa numa única instrução sobre uma única linha. Por outro lado, obriga **toda** transação participante a tratar falhas de serialização (`SQLSTATE 40001`) com retry. Sob a rajada da última cota, a maioria das transações abortaria e repetiria, gerando *retry storm* exatamente no pico, mais o custo de *predicate locks* (SSI). Read Committed com a condição no `UPDATE` dá o mesmo resultado com menos aborts e menos código.

**Por que `SELECT … FOR UPDATE` não foi adotado.** É correto, mas usa duas idas ao banco e segura o lock por mais tempo, e a regra fica espalhada entre a leitura e a escrita. Continua disponível para fluxos raros de várias linhas (ex.: cancelamento por moderação).

## Consequências

**Positivas (+)**
- Overbooking impossível por construção, inclusive com N réplicas do `api`; reserva Pix sem overbooking.
- PF = 1 cota garantido pelo banco, não pela aplicação.
- Explosão por lotação atômica com a última cota paga (D8).
- Sem dependência do Redis para corretude.

**Negativas (−)**
- **Linha quente:** todas as cotas de uma bolha serializam numa linha. Com ~2 ms por transação, o teto é de ~300–500 cotas/s por bolha, muito acima do esperado no R1. Mitigação, se necessário: transação mais curta (`INSERT` em lote do outbox) e, no limite, contadores particionados (não previsto).
- Mensagens 409 dependem de uma leitura de diagnóstico sem lock, que pode escolher o código "errado" numa corrida (ex.: `QUOTA_SOLD_OUT` em vez de `BUBBLE_NOT_ACTIVE`). Aceitável: as duas mensagens são verdadeiras naquele instante.
- Divergência consciente dos fatos canônicos (capacidade inclui `reserved_quotas`; índice cobre `RESERVED`), imposta pela Spec v1.1.

## Verificação

- **CT de concorrência (CI, Testcontainers):** bolha com 1 vaga, 100 requisições paralelas → 1 × 201, 99 × 409; `filled_quotas = max_quotas`; `count(quotas ACTIVE) = max_quotas`; 99 anulações de autorização no gateway falso.
- PF com 10 requisições paralelas (chaves diferentes) → 1 × 201, 9 × 409 `PF_QUOTA_LIMIT`.
- Reserva: 2 vagas, 2 reservas Pix → terceira entrada (cartão) recebe 409 `QUOTA_SOLD_OUT`; reserva expira → a vaga reabre.
- k6 com *threshold* `checks{type:overbooking}==0` na rajada da S7.

## Fontes

- Projeto: PRD v2.1 §5.2 e §8.2; Spec v1.1 F5 e §6; plano v2 §6 (D1), §7 (R2), §9; [modelo-dados.md §4.1](../modelo-dados.md).
- **asias-postgresql** — *PostgreSQL 17 Docs* §13.2 "Transaction Isolation": em Read Committed, `UPDATE`/`DELETE`/`SELECT FOR UPDATE` que encontram linha alterada por transação concorrente esperam o commit e **reavaliam a condição sobre a versão atualizada**, o que é "adequado para casos simples" de uma linha predeterminada; Repeatable Read/Serializable exigem retry em falha de serialização. §13.3 "Explicit Locking": deadlocks e o custo de manter locks por muito tempo. "CREATE INDEX": `UNIQUE` com `WHERE` impõe unicidade num subconjunto da tabela.
- Crítica ao Redlock (lease sem *fencing token*): conhecimento do autor (M. Kleppmann, "How to do distributed locking", 2016). A busca no AlterEgo (asias-dist-data-systems) **não** retornou trecho sobre o tema.
