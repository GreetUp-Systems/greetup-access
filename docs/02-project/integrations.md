# Contratos de Integração — GreetUp Access

> ⚠️ **Documento anterior à revisão de arquitetura de 20/08/2026.** Parte do conteúdo está
> superada (escrow, Treasury própria, KMS, CQRS, WebSocket). Em qualquer conflito, vale o
> [`MVP-REVISADO.md`](../06-sdd/MVP-REVISADO.md). Será revisado junto com as SPECs de cada bloco.

---

## 1. BlindPay

**Base URL:** `https://api.blindpay.com`  
**Autenticação:** `Authorization: Bearer ${BLINDPAY_API_KEY}` + `X-Instance-ID: ${BLINDPAY_INSTANCE_ID}`  
**Webhook secret:** `BLINDPAY_WEBHOOK_SECRET` (HMAC-SHA256 sobre o corpo raw da requisição)

### 1.1 Criar Receiver (KYB do Produtor)

```
POST /receivers
Content-Type: application/json

{
  "name": "Renata Campos",
  "tax_id": "000.000.000-00",
  "email": "renata@produtora.com",
  "phone": "+5531999990000",
  "country": "BR",
  "type": "individual" | "business"
}

Response 201:
{
  "id": "recv_xxx",
  "kyb_status": "pending" | "approved" | "rejected" | "under_review",
  "kyb_url": "https://kyb.blindpay.com/..."
}
```

### 1.2 Registrar Wallet Blockchain do Produtor

```
POST /receivers/{receiver_id}/wallets
Content-Type: application/json

{
  "network": "stellar" | "stellar_testnet",
  "address": "G...",
  "is_account_abstraction": true
}

Response 201:
{
  "id": "bwallet_xxx",
  "network": "stellar",
  "address": "G...",
  "trustline_xdr": "AAAA..." // XDR para assinar trustline USDC, se necessário
}
```

### 1.3 Registrar Conta Bancária (Chave Pix)

```
POST /receivers/{receiver_id}/bank-accounts
Content-Type: application/json

{
  "type": "pix",
  "pix_key": "renata@produtora.com",
  "pix_key_type": "email" | "cpf" | "cnpj" | "phone" | "random"
}

Response 201:
{
  "id": "bank_xxx",
  "pix_key": "renata@produtora.com",
  "is_default": true
}
```

### 1.4 Criar Quote de Payin (Pix → USDC)

```
POST /quotes
Content-Type: application/json

{
  "type": "payin",
  "source_currency": "BRL",
  "source_amount": 15000, // em centavos
  "destination_currency": "USDC",
  "destination_network": "stellar",
  "destination_address": "G..." // wallet do EscrowContract
}

Response 200:
{
  "id": "quote_xxx",
  "pix_code": "00020126...",
  "pix_expires_at": "2026-06-25T14:05:00Z",
  "source_amount_brl": 150.00,
  "destination_amount_usdc": 25.86,
  "fee_brl": 1.50,
  "exchange_rate": 0.1724
}
```

### 1.5 Confirmar Payin

```
POST /payins/stellar
Content-Type: application/json

{
  "quote_id": "quote_xxx",
  "idempotency_key": "purchase_uuid"
}

Response 201:
{
  "id": "payin_xxx",
  "status": "awaiting_payment",
  "pix_code": "00020126...",
  "pix_expires_at": "2026-06-25T14:05:00Z"
}
```

### 1.6 Webhook — payin.completed

```
POST /webhooks/blindpay (recebido pelo GreetUp)
Headers:
  blindpay-signature: hmac_sha256(raw_body, BLINDPAY_WEBHOOK_SECRET)

Body:
{
  "event": "payin.completed",
  "payin_id": "payin_xxx",
  "idempotency_key": "purchase_uuid",
  "amount_usdc": 25.86,
  "destination_address": "G...",
  "stellar_tx_hash": "abc123...",
  "settled_at": "2026-06-25T14:03:22Z"
}
```

**Tratamento:** validar HMAC → verificar idempotência por `payin_id` → enfileirar `MintTicketJob`.

### 1.7 Criar Payout (USDC → Pix)

```
POST /quotes
{ "type": "payout", "source_currency": "USDC", "source_amount": 25.86, ... }

POST /payouts/stellar/authorize
{ "quote_id": "quote_xxx", "receiver_id": "recv_xxx" }
// Retorna XDR de delegação para o produtor assinar

POST /payouts/stellar
{ "quote_id": "quote_xxx", "signed_delegation": "AAAA...", "bank_account_id": "bank_xxx" }

Response 201:
{
  "id": "payout_xxx",
  "status": "processing",
  "estimated_arrival": "2026-06-25T15:00:00Z"
}
```

### 1.8 Webhook — payout.completed

```
{
  "event": "payout.completed",
  "payout_id": "payout_xxx",
  "amount_brl": 145.20,
  "pix_key": "renata@produtora.com",
  "completed_at": "2026-06-25T14:58:11Z"
}
```

### 1.9 Tratamento de Falhas

| Cenário | Comportamento esperado |
|---|---|
| Timeout na criação do payin | Retry com idempotency_key, resposta idempotente |
| Webhook duplicado | Verificar `payin_id` na tabela purchases — se já processado, retornar 200 sem reprocessar |
| Payout falha após escrow_done | `PayoutRecoveryWorker` detecta após 10 min e retenta apenas o payout |
| BlindPay indisponível | Fallback: fila com retry exponencial; alerta no Prometheus se > 3 falhas consecutivas |

---

## 2. Privy

**SDK:** `@privy-io/react-auth` (frontend) + `@privy-io/node` (backend)  
**Variáveis:** `PRIVY_APP_ID`, `PRIVY_APP_SECRET`

### 2.1 Verificar Token JWT (Backend)

```typescript
// src/auth/privy/privy-auth.service.ts
import { PrivyClient } from '@privy-io/node';

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

async verifyToken(token: string) {
  const claims = await privy.verifyAuthToken(token);
  return claims; // { userId, sessionId, expiration }
}

async getStellarWalletAddresses(privyUserId: string): Promise<string[]> {
  const user = await privy.getUser(privyUserId);
  return user.linkedAccounts
    .filter(a => a.type === 'wallet' && a.chainType === 'stellar')
    .map(a => a.address);
}
```

### 2.2 Criar Wallet Stellar (Frontend)

```typescript
// apps/web — após login
import { usePrivy, useCreateWallet } from '@privy-io/react-auth';

const { user } = usePrivy();
const { createWallet } = useCreateWallet();

// Verifica se já tem wallet Stellar
let stellarAccount = user?.linkedAccounts.find(
  a => a.type === 'wallet' && a.chainType === 'stellar'
);

// Cria se não tiver (controle manual — não automático)
if (!stellarAccount) {
  stellarAccount = await createWallet({ chainType: 'stellar' });
}

// Registra no backend com token no header
await api.post('/auth/wallet',
  { stellarAddress: stellarAccount.address },
  { headers: { Authorization: `Bearer ${await getAccessToken()}` } }
);
```

### 2.3 Assinar Transação Stellar (Frontend — apenas para off-ramp)

```typescript
// Usado apenas quando o produtor confirma retirada
// O comprador nunca precisa assinar nada

async function signXdr(unsignedXdr: string, stellarAddress: string) {
  const { TransactionBuilder, Keypair, xdr } = await import('@stellar/stellar-sdk');

  const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
  const hash = tx.hash(); // nativo no browser, sem workaround

  const { signature } = await signRawHash({
    address: stellarAddress,
    chainType: 'stellar',
    hash: `0x${hash.toString('hex')}`,
  });

  const keypair = Keypair.fromPublicKey(stellarAddress);
  const decoratedSig = new xdr.DecoratedSignature({
    hint: keypair.signatureHint(),
    signature: Buffer.from(signature.slice(2), 'hex'),
  });

  tx.signatures.push(decoratedSig);
  return tx.toEnvelope().toXDR('base64');
}
```

### 2.4 Policy Signer (Operações sem interação do usuário)

Para mint de tickets e check-in on-chain, o backend usa um policy signer configurado na wallet do comprador, com escopo restrito:

```typescript
// Configurado durante a criação da wallet do comprador
// O policy signer só pode assinar operações específicas:
// - TicketContract.mint()
// - TicketContract.check_in()
// Não pode transferir USDC ou executar qualquer outra operação

const policySignerConfig = {
  allowedContracts: [TICKET_CONTRACT_ADDRESS],
  allowedFunctions: ['mint', 'check_in'],
  expiresAt: null, // permanente para este signer
};
```

---

## 3. Soroban — TicketContract

**Contract address:** `${SOROBAN_TICKET_CONTRACT_ADDRESS}` (diferente por rede)  
**Rede testnet:** `Test SDF Network ; September 2015`  
**Rede mainnet:** `Public Global Stellar Network ; September 2015`

### 3.1 Funções de Escrita

```rust
// Mint de ingresso — requer authority do backend (policy signer)
fn mint(
  env: Env,
  event_id: Symbol,        // ID do evento
  ticket_type_id: Symbol,  // Tipo do ingresso
  owner: Address,          // Wallet do comprador
  purchase_id: Symbol,     // Idempotência on-chain
  metadata_hash: Bytes,    // SHA-256 dos dados off-chain
) -> Symbol                // Retorna ticket_id

// Check-in — requer authority do staff ou backend
fn check_in(
  env: Env,
  ticket_id: Symbol,
  event_id: Symbol,
  staff_address: Address,
  timestamp: u64,
) -> bool

// Transferência — só se ticket.transferable = true e status = issued
fn transfer(env: Env, ticket_id: Symbol, from: Address, to: Address) -> bool

// Cancelar ingresso individual
fn cancel(env: Env, ticket_id: Symbol, authorized_by: Address) -> bool

// Cancelar todos os tickets do evento — multi-sig 2-of-3
fn cancel_event(env: Env, event_id: Symbol) -> u32 // retorna count

// Invalidar ticket administrativamente
fn invalidate(env: Env, ticket_id: Symbol, reason: Symbol) -> bool
```

### 3.2 Funções de Leitura

```rust
fn get_ticket(env: Env, ticket_id: Symbol) -> TicketData
fn validate_qr(env: Env, ticket_id: Symbol, nonce: Symbol, signature: Bytes) -> ValidationResult
fn get_event_stats(env: Env, event_id: Symbol) -> EventStats // capacity, issued, checked_in
```

### 3.3 Eventos emitidos

```rust
// Indexados pelo Horizon e consumidos pelo worker de sincronização
events!(
  TicketMinted { ticket_id, event_id, owner, purchase_id, timestamp },
  TicketCheckedIn { ticket_id, event_id, staff, timestamp },
  TicketCancelled { ticket_id, event_id, reason, timestamp },
  TicketTransferred { ticket_id, from, to, timestamp },
  EventCancelled { event_id, count, timestamp },
)
```

---

## 4. Soroban — EscrowContract

### 4.1 Funções de Escrita

```rust
// Depósito após confirmação do payin
fn deposit(
  env: Env,
  event_id: Symbol,
  seller: Address,
  amount_usdc: i128,
  release_at: u64,    // timestamp de liberação
  purchase_id: Symbol // idempotência
) -> Symbol           // escrow_id

// Liberação — requer multi-sig 2-of-3 + time-lock + rate limit
fn release(
  env: Env,
  escrow_id: Symbol,
  signatures: Vec<Signature>, // 2 de 3 signers autorizados
) -> bool

// Bloqueio — cancelamento ou disputa — multi-sig 2-of-3
fn block(
  env: Env,
  escrow_id: Symbol,
  reason: Symbol,
  signatures: Vec<Signature>,
) -> bool

// Reembolso parcial ou total — multi-sig 2-of-3
fn refund(
  env: Env,
  escrow_id: Symbol,
  buyer: Address,
  amount: i128,
  signatures: Vec<Signature>,
) -> bool

// Emergência — pausa todos os releases — multi-sig 2-of-3
fn pause(env: Env, signatures: Vec<Signature>) -> bool
fn unpause(env: Env, signatures: Vec<Signature>) -> bool
```

### 4.2 Invariantes do Contrato

- `release()` só executa se `env.ledger().timestamp() >= escrow.release_at`
- `release()` respeita cooldown de 300 segundos por `seller_address` (rate limit on-chain)
- `release()` não executa se o contrato estiver pausado
- `block()` não pode ser desfeito sem multi-sig 2-of-3
- `refund()` reduz o saldo do escrow — não pode exceder o saldo disponível

---

## 5. WebSocket Events (Real-time)

O backend emite eventos via Socket.io para clientes conectados em suas rooms.

### Rooms
- `tenant:{organization_id}:producer` — dashboard do produtor
- `tenant:{organization_id}:staff:{event_id}` — PWA de credenciamento
- `buyer:{purchase_id}` — área do comprador (confirmação de compra)

### Eventos emitidos

```typescript
// Para o produtor
socket.to(`tenant:${orgId}:producer`).emit('sale.new', {
  ticket_type: string,
  buyer_email: string,
  amount_brl: number,
  total_sold: number,
});

socket.to(`tenant:${orgId}:producer`).emit('checkin.registered', {
  event_id: string,
  holder_name: string,
  checked_in_count: number,
  total_sold: number,
});

socket.to(`tenant:${orgId}:producer`).emit('balance.updated', {
  pending: number,
  available: number,
  withdrawn: number,
});

// Para o comprador
socket.to(`buyer:${purchaseId}`).emit('ticket.issued', {
  ticket_id: string,
  qr_code_url: string,
  status: 'issued',
});

// Para o staff
socket.to(`tenant:${orgId}:staff:${eventId}`).emit('snapshot.updated', {
  generated_at: string,
  ticket_count: number,
});
```

---

## 6. Variáveis de Ambiente por Serviço

### apps/api e apps/workers (compartilhadas)

```bash
# Privy
PRIVY_APP_ID=
PRIVY_APP_SECRET=

# BlindPay
BLINDPAY_API_KEY=
BLINDPAY_INSTANCE_ID=
BLINDPAY_BASE_URL=https://api.blindpay.com
BLINDPAY_WEBHOOK_SECRET=

# Stellar
STELLAR_NETWORK=testnet | mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=
STELLAR_USDC_ASSET_CODE=USDC
STELLAR_USDC_ISSUER=

# Contratos
SOROBAN_TICKET_CONTRACT_ADDRESS=
SOROBAN_ESCROW_CONTRACT_ADDRESS=

# Treasury (signing via KMS)
KMS_KEY_ID=arn:aws:kms:...
TREASURY_STELLAR_ADDRESS=G...

# Banco de dados
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET=

# AWS
AWS_REGION=us-east-1
# Autenticação via OIDC no CI/CD — sem credenciais estáticas
```

### apps/web

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_URL=https://api.greetup.com
NEXT_PUBLIC_WS_URL=wss://api.greetup.com
NEXT_PUBLIC_STELLAR_NETWORK=testnet | mainnet
```
