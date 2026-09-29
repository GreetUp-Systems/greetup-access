# ADR-001 — Stellar sobre EVM como blockchain principal

**Status:** Aceito | **Data:** 25/06/2026 | **Autor:** Matheus Aguiar

## Contexto

O Access precisa de blockchain para ingressos tokenizados e escrow. Avaliadas: Polygon PoS (EVM) e Stellar (Soroban).

## Opções Avaliadas

**Polygon PoS:** ecossistema maduro, OpenZeppelin, ERC-721/4337, gas ~$0.002/tx, Privy SDK nativo.

**Stellar (Soroban):** gas ~$0.00001/tx (200x mais barato), USDC nativo, BlindPay parceiro nativo Stellar, Privy suporta Stellar, relacionamento com SDF para grants $5K–$150K.

## Decisão

**Stellar (Soroban).**

## Justificativa

1. Custo de transação 200x menor — eventos de 5.000+ pessoas com múltiplas tx por ingresso
2. USDC nativo — sem bridge, sem risco de wrapped token
3. BlindPay suporta Stellar em payin e payout confirmado em produção
4. Grants SDF: produto real na Stellar aumenta chances de aprovação
5. Relacionamento existente com SDF como ativo estratégico

## Consequências

- Contratos em Rust (Soroban) — tooling menos maduro que Solidity
- Policy signer requer configuração manual (sem ERC-4337 out-of-the-box)
- Ecossistema menor de auditores Soroban vs Solidity
- Migração para EVM é projeto de engenharia definido se necessário — sem impacto no produto

## Revisão

Revisitar se: BlindPay descontinuar suporte Stellar; Privy descontinuar suporte Stellar; custo de dev Soroban superar 30% do prazo.
