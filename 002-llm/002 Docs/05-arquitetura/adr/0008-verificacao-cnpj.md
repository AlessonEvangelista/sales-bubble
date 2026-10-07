# ADR-0008 — Verificação de CNPJ via BrasilAPI (primário) + ReceitaWS (fallback), com cache e revalidação a cada 30 dias

**Versão:** 1.0 · **Data:** 06/10/2026 · **Status:** Proposto
**Base:** [PRD v2.1 RF01.1](../../../PRD.MD) · [Spec v1.1 F1](../../../SPEC.md) · decisão do plano: **D7**
**Decisores:** PO, Tech Lead, Jurídico · **Revisar em:** se a taxa de indisponibilidade dos provedores passar de 1% ao mês, ou com a contratação de um provedor pago (ex.: Serpro)

## Contexto

- O PRD exige "CNPJ ativo verificado junto à Receita Federal", mas não há API pública oficial gratuita e em tempo real. Provedores públicos (BrasilAPI, ReceitaWS) agregam dados da Receita, com limites de taxa e disponibilidade variável.
- Spec v1.1 F1: situação ATIVA ativa a conta; irregular bloqueia o cadastro (`CNPJ_NOT_ACTIVE`); provedor indisponível → conta `PENDING_VERIFICATION` (navega, mas não cria bolha, não compra cota nem dá lance — `ACCOUNT_NOT_VERIFIED`), com nova tentativa a cada 15 min por 24 h; revalidação a cada 30 dias; CNPJ que fica irregular bloqueia novas ações, mas as bolhas em andamento seguem.

## Decisão

1. Porta `CnpjLookupPort.lookup(cnpj): Promise<CnpjStatus>` com adapters `BrasilApiCnpjAdapter` (primário) e `ReceitaWsCnpjAdapter` (fallback), compostos por um `FallbackCnpjLookup` com **timeout de 3 s** por provedor e **circuit breaker** (abre após 5 falhas em 1 min; meia-abertura após 30 s).
2. Validação local do dígito verificador antes de qualquer chamada externa.
3. Normalização: `situacao_cadastral` → `ATIVA | SUSPENSA | INAPTA | BAIXADA | NULA`; guarda razão social, CNAE principal, provedor e `cnpj_checked_at` em `company_profiles`. O CNPJ em si fica cifrado em `accounts.document_enc` + `document_hash` (ADR-0012).
4. **Cache** no Redis por 24 h (chave = hash do CNPJ) para cadastros repetidos e retentativas; a fonte persistente é `company_profiles`.
5. Fila `cnpj-verification-retry`: `retry` a cada 15 min por até 24 h para contas `PENDING_VERIFICATION`; `revalidate` quando `cnpj_next_check_at <= now()` (30 dias). O resultado irregular numa revalidação **não** cancela bolhas em andamento: só bloqueia novas ações (checagem nos casos de uso).
6. Toda consulta gera registro em `audit_log` (sem o CNPJ em claro).

## Alternativas consideradas

| Critério | **A. BrasilAPI + ReceitaWS (escolhida)** | B. Serpro (API oficial paga) | C. Só dígito verificador | D. Validação manual por documento |
| :--- | :---: | :---: | :---: | :---: |
| Custo | ●●● gratuito | ● contrato e custo por consulta | ●●● | ● operação |
| Reversibilidade | ●●● (porta; Serpro vira novo adapter) | ●●● | ●● | ●● |
| Complexidade | ●● fallback + breaker | ●● | ●●● | ● |
| Risco | ●● disponibilidade e rate limit de terceiros; dados podem ter defasagem | ●●● | ● aceita CNPJ baixado/inapto (fraude, R8) | ●● lento; não escala |

## Consequências

**Positivas (+)** Custo zero no R1; degradação controlada (`PENDING_VERIFICATION`) em vez de bloquear o cadastro.
**Negativas (−)** Dependência de serviços sem SLA → métrica de disponibilidade por provedor e alerta; plano de troca para Serpro (B) se necessário. Defasagem de dados da Receita nos agregadores → revalidação periódica e denúncias (moderação).

## Verificação

Testes de contrato com *fixtures* de cada provedor; teste com BrasilAPI fora do ar → fallback ReceitaWS; ambos fora → `PENDING_VERIFICATION` + 96 retentativas agendadas; CNPJ baixado → `CNPJ_NOT_ACTIVE`.

## Fontes

- Projeto: Spec v1.1 F1; plano v2 §6 (D7), §7 (R8).
- **asias-arquitetura-hexagonal** — *Skill*: porta nomeada pela necessidade ("consultar situação cadastral") e adapters intercambiáveis por provedor.
- **architect** — *MS Engineering Playbook*, guia de requisitos não funcionais (disponibilidade e interoperabilidade com sistemas externos como atributos mensuráveis).
