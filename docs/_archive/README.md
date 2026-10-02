# Arquivo — documentação superada

Documentos da arquitetura original (junho–julho de 2026), superados pela revisão de 20/08/2026
descrita em [`../06-sdd/MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md).

Ficam aqui como registro histórico das decisões. **Não implemente a partir deles.**

## ADRs

| Documento | Superado por |
|---|---|
| [ADR-003](./03-adrs/ADR-003-cqrs-tickets-finance.md) — CQRS em Tickets e Finance | D-16: sem cache e sem CQRS |
| [ADR-008](./03-adrs/ADR-008-soroban-contracts.md) — contratos Soroban próprios sobre SEP-50 | D-03: extensão do NFT auditado da OpenZeppelin |

## Runbooks

| Documento | Superado por |
|---|---|
| [RB-002](./04-runbooks/RB-002-kms-key-compromise.md) — comprometimento de chave KMS | D-02: sem Treasury própria nem KMS |
| [RB-006](./04-runbooks/RB-006-treasury-recharge.md) — recarga da Treasury | D-02: gas pelo OpenZeppelin Relayer |
| [RB-007](./04-runbooks/RB-007-soroban-migration.md) — migração de contrato Soroban | D-03 e D-12: contrato novo, sem `EscrowContract` |

## SPECs

SPECs marcadas como "Reescrever" no `OVERVIEW.md`. Serão reescritas no momento de implementar o
bloco correspondente.

| Documento | Motivo |
|---|---|
| [SPEC-003](./06-sdd/SPEC-003-organizations.md) — organizations | BlindPay usa *customer*, não *receiver* (D-09) |
| [SPEC-004](./06-sdd/SPEC-004-events.md) — events | Tenancy por produtor (D-20), sem escrow no cancelamento (D-12) e política de reembolso como texto livre |
| [SPEC-005](./06-sdd/SPEC-005-purchase.md) — purchase | Fluxo passa a ser payin quote → payin (D-08) |
| [SPEC-006](./06-sdd/SPEC-006-contracts.md) — contracts | `EscrowContract` sai; `TicketContract` vira extensão da OZ (D-03, D-12). Contém bug de tipo: `Symbol` não comporta UUID |
| [SPEC-007](./06-sdd/SPEC-007-mint-worker.md) — mint worker | Sai Treasury própria e criação de wallet do caminho crítico (D-02, D-06) |
| [SPEC-008](./06-sdd/SPEC-008-ticket-read.md) — ticket read | Sem CQRS (D-16) |
| [SPEC-010](./06-sdd/SPEC-010-finance.md) — finance | Não há escrow (D-12) |
| [SPEC-011](./06-sdd/SPEC-011-withdrawal.md) — withdrawal | Saque é payout da BlindPay |
