# SPEC-006 — Soroban Contracts (TicketContract + EscrowContract)

**Objetivo:** Implementar os dois contratos Soroban em Rust: TicketContract (emissão, estados, check-in) e EscrowContract (custódia, liberação, bloqueio de saldo).

**Pré-requisitos:** SPEC-001 (estrutura de pastas)

**Pode ser desenvolvido em paralelo com SPEC-002 a SPEC-005.**

**Tempo estimado:** 3-4 dias

---

## 1. Estrutura de arquivos

```
packages/contracts/
├── Cargo.toml                           ← workspace
├── Cargo.lock
├── ticket-contract/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                       ← entry point
│       ├── contract.rs                  ← impl do contrato
│       ├── types.rs                     ← structs e enums
│       ├── errors.rs                    ← erros tipados
│       └── storage.rs                  ← chaves de storage
│   └── tests/
│       ├── integration_test.rs
│       └── helpers.rs
├── escrow-contract/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── contract.rs
│       ├── types.rs
│       ├── errors.rs
│       └── storage.rs
│   └── tests/
│       ├── integration_test.rs
│       └── helpers.rs
└── shared/
    ├── Cargo.toml
    └── src/
        └── lib.rs                       ← tipos compartilhados
```

---

## 2. TicketContract — tipos e interface

```rust
// ticket-contract/src/types.rs

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum TicketStatus {
    Reserved,
    Issued,
    CheckedIn,
    Cancelled,
    Refunded,
    Expired,
    Invalidated,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct TicketData {
    pub ticket_id: Symbol,
    pub event_id: Symbol,
    pub ticket_type_id: Symbol,
    pub owner: Address,
    pub purchase_id: Symbol,     // chave de idempotência
    pub metadata_hash: Bytes,    // SHA-256 dos dados off-chain
    pub status: TicketStatus,
    pub transferable: bool,
    pub issued_at: u64,
    pub expires_at: u64,
    pub checkin_at: Option<u64>,
}

#[contracttype]
pub struct EventConfig {
    pub event_id: Symbol,
    pub capacity_max: u32,
    pub capacity_issued: u32,
    pub admin: Address,          // GreetUp backend address
}
```

```rust
// ticket-contract/src/contract.rs — interface pública

pub trait TicketContractTrait {
    // Inicializa o contrato com admin e config do evento
    fn initialize(env: Env, admin: Address, event_id: Symbol, capacity_max: u32) -> Result<(), ContractError>;

    // Minta ticket — requer autorização do admin (policy signer)
    // Idempotente por purchase_id
    fn mint(
        env: Env,
        event_id: Symbol,
        ticket_type_id: Symbol,
        owner: Address,
        purchase_id: Symbol,
        metadata_hash: Bytes,
        transferable: bool,
    ) -> Result<Symbol, ContractError>; // retorna ticket_id

    // Registra check-in — requer autorização do admin
    // Idempotente: segunda chamada com mesmo ticket_id retorna Ok sem duplicar
    fn check_in(
        env: Env,
        ticket_id: Symbol,
        event_id: Symbol,
        staff_address: Address,
        timestamp: u64,
    ) -> Result<(), ContractError>;

    // Transfere ticket — só se transferable=true e status=Issued
    fn transfer(env: Env, ticket_id: Symbol, from: Address, to: Address) -> Result<(), ContractError>;

    // Cancela ticket individual — requer admin
    fn cancel(env: Env, ticket_id: Symbol) -> Result<(), ContractError>;

    // Cancela todos os tickets do evento — requer admin
    // ATENÇÃO: pode ser custoso em eventos grandes — usar com lote se necessário
    fn cancel_event(env: Env, event_id: Symbol) -> Result<u32, ContractError>;

    // Invalida administrativamente
    fn invalidate(env: Env, ticket_id: Symbol, reason: Symbol) -> Result<(), ContractError>;

    // Leitura
    fn get_ticket(env: Env, ticket_id: Symbol) -> Result<TicketData, ContractError>;
    fn get_event_stats(env: Env, event_id: Symbol) -> Result<EventConfig, ContractError>;
    fn validate_qr(env: Env, ticket_id: Symbol, nonce: Symbol) -> Result<bool, ContractError>;

    // Pausa de emergência — requer admin
    fn pause(env: Env) -> Result<(), ContractError>;
    fn unpause(env: Env) -> Result<(), ContractError>;
}
```

---

## 3. EscrowContract — tipos e interface

```rust
// escrow-contract/src/types.rs

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum BalanceStatus {
    PendingSettlement,
    Blocked,
    Available,
    Withdrawn,
    Refunded,
    Disputed,
}

#[contracttype]
pub struct EscrowData {
    pub escrow_id: Symbol,
    pub event_id: Symbol,
    pub seller: Address,
    pub amount_usdc: i128,
    pub purchase_id: Symbol,     // idempotência
    pub status: BalanceStatus,
    pub release_at: u64,         // timestamp — time-lock
    pub created_at: u64,
}

// Política de multi-sig (definida no initialize)
#[contracttype]
pub struct AdminPolicy {
    pub signers: Vec<Address>,   // [signer_a, signer_b, signer_c]
    pub threshold: u32,          // 2
}
```

```rust
// escrow-contract/src/contract.rs — interface pública

pub trait EscrowContractTrait {
    // Configura admins e política multi-sig
    fn initialize(env: Env, admin_policy: AdminPolicy) -> Result<(), ContractError>;

    // Deposita USDC no escrow após confirmação do payin
    // Idempotente por purchase_id
    fn deposit(
        env: Env,
        event_id: Symbol,
        seller: Address,
        amount_usdc: i128,
        purchase_id: Symbol,
        release_at: u64,
    ) -> Result<Symbol, ContractError>; // retorna escrow_id

    // Libera saldo para o seller
    // Verifica: time-lock, multi-sig, rate-limit (300s entre releases do mesmo seller), not paused
    fn release(
        env: Env,
        escrow_id: Symbol,
        auth_signatures: Vec<(Address, BytesN<64>)>, // assinaturas dos signers
    ) -> Result<(), ContractError>;

    // Bloqueia saldo — cancelamento ou disputa
    // Requer multi-sig
    fn block(
        env: Env,
        escrow_id: Symbol,
        reason: Symbol,
        auth_signatures: Vec<(Address, BytesN<64>)>,
    ) -> Result<(), ContractError>;

    // Reembolso parcial ou total
    fn refund(
        env: Env,
        escrow_id: Symbol,
        buyer: Address,
        amount: i128,
        auth_signatures: Vec<(Address, BytesN<64>)>,
    ) -> Result<(), ContractError>;

    // Pausa de emergência — bloqueia todos os releases
    fn pause(env: Env, auth_signatures: Vec<(Address, BytesN<64>)>) -> Result<(), ContractError>;
    fn unpause(env: Env, auth_signatures: Vec<(Address, BytesN<64>)>) -> Result<(), ContractError>;

    // Leitura
    fn get_balance(env: Env, escrow_id: Symbol) -> Result<EscrowData, ContractError>;
    fn get_seller_balances(env: Env, seller: Address) -> Result<Vec<EscrowData>, ContractError>;
}
```

---

## 4. Erros tipados (ambos os contratos)

```rust
// src/errors.rs
#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CapacityExceeded = 4,
    TicketNotFound = 5,
    InvalidTicketStatus = 6,
    AlreadyCheckedIn = 7,
    NotTransferable = 8,
    TimeLockActive = 9,
    RateLimitExceeded = 10,
    InsufficientSignatures = 11,
    InvalidSignature = 12,
    ContractPaused = 13,
    DuplicatePurchaseId = 14,
    EscrowNotFound = 15,
    InvalidAmount = 16,
}
```

---

## 5. Cargo.toml (workspace)

```toml
[workspace]
members = [
    "ticket-contract",
    "escrow-contract",
    "shared",
]
resolver = "2"

[workspace.dependencies]
soroban-sdk = { version = "21.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

---

## 6. Testes esperados (Rust)

### TicketContract
```rust
// tests/integration_test.rs
#[test] fn test_mint_creates_ticket_with_issued_status()
#[test] fn test_mint_is_idempotent_by_purchase_id()
#[test] fn test_mint_fails_when_capacity_exceeded()
#[test] fn test_checkin_transitions_to_checked_in()
#[test] fn test_checkin_is_idempotent()
#[test] fn test_checkin_fails_for_cancelled_ticket()
#[test] fn test_checkin_fails_for_refunded_ticket()
#[test] fn test_transfer_works_when_transferable()
#[test] fn test_transfer_fails_when_not_transferable()
#[test] fn test_transfer_fails_after_checkin()
#[test] fn test_cancel_event_invalidates_all_tickets()
#[test] fn test_unauthorized_mint_fails()
#[test] fn test_pause_blocks_all_operations()
```

### EscrowContract
```rust
#[test] fn test_deposit_creates_escrow_with_pending_status()
#[test] fn test_deposit_is_idempotent_by_purchase_id()
#[test] fn test_release_fails_before_time_lock()
#[test] fn test_release_succeeds_after_time_lock_with_valid_multisig()
#[test] fn test_release_fails_with_insufficient_signatures()
#[test] fn test_rate_limit_blocks_rapid_releases()
#[test] fn test_block_prevents_release()
#[test] fn test_refund_reduces_escrow_amount()
#[test] fn test_pause_blocks_release()
#[test] fn test_unpause_re_enables_release()
```

---

## 7. Build e deploy

```bash
# Build local
stellar contract build --manifest-path packages/contracts/Cargo.toml

# Verificar tamanho (máx 64KB por contrato)
wc -c packages/contracts/target/wasm32-unknown-unknown/release/ticket_contract.wasm

# Deploy em testnet
stellar contract deploy \
  --wasm packages/contracts/target/wasm32-unknown-unknown/release/ticket_contract.wasm \
  --source $DEPLOY_KEYPAIR_TESTNET \
  --network testnet

# Inicializar
stellar contract invoke \
  --id $TICKET_CONTRACT_ADDRESS \
  --fn initialize \
  --network testnet \
  -- --admin $BACKEND_ADDRESS --event_id "evt_001" --capacity_max 500
```

---

## 8. Variáveis necessárias

```bash
SOROBAN_TICKET_CONTRACT_ADDRESS=
SOROBAN_ESCROW_CONTRACT_ADDRESS=
MULTISIG_SIGNER_A_ADDRESS=   # backend KMS
MULTISIG_SIGNER_B_ADDRESS=   # fundador HSM
MULTISIG_THRESHOLD=2
```

---

## 9. Definição de Pronto

- [ ] `cargo test` passa para ambos os contratos
- [ ] WASM compilado para release com tamanho < 64KB cada
- [ ] Deploy em testnet executado com sucesso
- [ ] `initialize()` chamado com admin e policy configurados
- [ ] Idempotência de mint e check-in testada on-chain
- [ ] SHA256 dos WASMs documentado no CHANGELOG
