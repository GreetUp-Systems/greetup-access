# ADR-008 — Contratos Soroban próprios sobre padrão SEP-50

**Status:** ⛔ **Superado em 20/08/2026** — ver [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md), D-03
**Status original:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

> ## Por que foi superado
>
> **A premissa estava errada, não o raciocínio.** Este ADR decidiu por contratos próprios
> argumentando que "SEP-50 é proposta, sem implementações auditadas em produção". A alternativa
> avaliada foi a errada: existe o módulo **Non-Fungible Token da OpenZeppelin Stellar Contracts**,
> em Rust, auditado, listado na documentação oficial da Stellar sob "Audited Modules Available",
> com verificação formal pela Certora em andamento. A doc oficial recomenda explicitamente essa
> biblioteca como o caminho mais rápido para um contrato de token customizado.
>
> A interface dela cobre boa parte das regras de negócio direto: `max_supply` (RN-003),
> `owner_of` (RN-001), `get_owner_tokens`, `transfer`, `burn`.
>
> O segundo argumento — "EscrowContract não tem equivalente no SEP-50, então precisamos de contrato
> próprio de qualquer forma" — também caiu: **não há EscrowContract.** O escrow saiu da blockchain
> (D-09, D-12).
>
> **Decisão vigente:** o contrato de ingresso é uma **extensão** da base auditada da OpenZeppelin.
> Código próprio fica restrito a check-in, vínculo com evento e idempotência por `purchase_id` — que
> é onde auditoria vale a pena.
>
> **Nota de implementação herdada:** a SPEC-006 passa `purchase_id`, `ticket_id` e `event_id` como
> `Symbol`, mas são UUID no Prisma. `Symbol` aceita no máximo 32 caracteres e só `a-zA-Z0-9_`;
> UUID tem 36 com hífens. Não compila. Usar `BytesN<16>`.
>
> O raciocínio abaixo fica preservado como registro.

---

## Contexto

Para ingressos tokenizados na Stellar: usar SEP-50 (proposta Non-Fungible Stellar) ou desenvolver contratos próprios (TicketContract + EscrowContract).

## Decisão

**Contratos Soroban próprios** em Rust.

## Justificativa

1. SEP-50 é proposta — sem implementações auditadas em produção
2. Contratos próprios permitem regras específicas: estados de ingresso, rate limit on-chain, multi-sig customizado, time-lock de escrow
3. EscrowContract não tem equivalente no SEP-50 — contrato próprio necessário de qualquer forma
4. Maior controle: pause(), cancel_event() em batch, validate_qr() on-chain, idempotência por purchase_id

## Consequências

- Mais trabalho: Rust + Soroban SDK, testes com soroban-env-host
- Auditoria necessária antes do go-live em produção
- Imutabilidade: bugs exigem deploy de novo WASM — planejar mecanismo de upgrade desde o design
- Tooling: stellar-cli para build/deploy
