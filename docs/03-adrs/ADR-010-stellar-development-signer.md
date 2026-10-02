# ADR-010 — Signer Stellar local no desenvolvimento

> **Status:** aceito
>
> **Data:** 02/10/2026
>
> **Decisores:** Matheus Aguiar e equipe Access

## Contexto

O gate 3C precisa validar na Stellar Testnet a criação patrocinada da conta e da trustline USDB.
Operar um OpenZeppelin Relayer self-hosted antes dessa validação adicionaria infraestrutura sem
alterar as invariantes da transação interna: a wallet do produtor continua autorizando apenas suas
operações e a conta patrocinadora continua autorizando apenas as operações do Access.

## Decisão

Em `development` e `test`, o backend pode carregar uma conta patrocinadora dedicada à Stellar
Testnet por `STELLAR_SPONSOR_SECRET_KEY`, assinar a transação clássica internamente e pagar sua taxa
normal. Esse modo:

- aceita exclusivamente `STELLAR_NETWORK=testnet` e o ativo USDB da BlindPay;
- exige que a secret corresponda a `STELLAR_SPONSOR_PUBLIC_KEY`;
- mantém a secret somente no `.env` local, que não é versionado;
- nunca persiste ou registra secret, JWT, assinatura ou XDR assinado;
- continua exigindo a assinatura Ed25519 da wallet user-owned do produtor via Privy;
- não aplica fee bump: como fonte da transação, o sponsor paga a taxa clássica diretamente.

Em `production`, `STELLAR_SPONSOR_SECRET_KEY` é proibida e o processo falha fechado. A custódia
gerenciada, rotação, recuperação e integração com OpenZeppelin Relayer serão decididas antes da
habilitação de Pubnet/USDC.

## Consequências

### Positivas

- permite validar o fluxo econômico completo na Testnet sem operar outro serviço;
- preserva a separação de autorização entre produtor e sponsor;
- torna explícito no startup que o signer local não é uma configuração de produção.

### Limitações aceitas

- reiniciar ou rotacionar a conta exige atualização manual do `.env` local;
- não há fee bump no modo de desenvolvimento;
- a decisão de custódia de produção permanece aberta e não pode ser inferida deste ADR.
