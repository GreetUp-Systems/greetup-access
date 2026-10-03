# SPEC-006 — Contrato do ingresso

> **Status:** aprovada; implementação não iniciada
>
> **Versão:** 1.0
>
> **Atualizada em:** 03/10/2026
>
> **Aprovada em:** 03/10/2026
>
> **Bloco:** 5 do [`OVERVIEW.md`](./OVERVIEW.md) · **Depende de:** SPEC-001.
> [Versão anterior arquivada](../_archive/06-sdd/SPEC-006-contracts.md)

## 1. Objetivo

Entregar o `TicketContract`: o NFT do ingresso na Stellar, como extensão do módulo auditado da
OpenZeppelin (D-03), com o vínculo do ingresso ao evento, mint idempotente, limite de capacidade
por evento, check-in e as regras de transferência do MVP. O contrato é compilado, testado e
implantado na Testnet com o Caatinga (D-25).

Ao final desta SPEC:

1. o contrato existe em `packages/contracts`, compila para `wasm32v1-none` e passa nos testes;
2. está implantado na Testnet, com ID e hash do WASM registrados em `caatinga.artifacts.json`;
3. o CI compila e testa o contrato a cada PR.

## 2. Decisões consumidas

- **D-03:** extensão do NFT da OpenZeppelin; só vínculo com evento, idempotência, capacidade,
  check-in e regras de transferência são código nosso.
- **D-04/D-05:** o comprador é dono; transferência única, exigindo assinatura do dono e da
  plataforma.
- **D-23:** o mint não depende de a conta do destinatário estar ativa na rede. A conta precisa
  existir quando o dono assina uma transferência — garantido pela regra de ativação.
- **D-24:** a conta Stellar do Access assina como plataforma; ela é a dona (`owner`) do contrato.
- **RN-001 a RN-004 e RN-010:** ID único por ingresso, check-in único, capacidade máxima, nada de
  dado pessoal on-chain.
- Nota de implementação do `MVP-REVISADO.md` §7: UUIDs viajam como `BytesN<16>`, nunca `Symbol`.

## 3. Escopo

### Inclui

- workspace Cargo e crate `ticket_contract`;
- cadastro de capacidade por evento, mint, check-in, transferência e leituras;
- `upgrade(new_wasm_hash)` próprio, restrito ao dono e compatível com `ctg upgrade`;
- testes unitários Rust com `soroban-sdk` `testutils`;
- configuração do Caatinga e deploy na Testnet;
- ajuste do job de contratos do CI e remoção de `contracts-deploy.yml`.

### Fora do escopo

- cancelamento de evento on-chain — o estado vive no Postgres e a plataforma deixa de co-assinar;
- burn — reembolso e invalidação ficam fora do sistema no MVP;
- extensão Enumerable — a listagem de ingressos sai do Postgres (D-16);
- royalties, pausa, aprovações e `transfer_from`;
- bindings TypeScript, ID do contrato na API, `MintTicketWorker` e Relayer — bloco 6;
- decisão de quando chamar `set_event_capacity` (publicação ou primeiro mint) — bloco 6;
- Pubnet.

## 4. Versões e ferramentas

| Item             | Versão           | Observação                                                           |
| ---------------- | ---------------- | -------------------------------------------------------------------- |
| `stellar-tokens` | `=0.7.2`         | última estável da OpenZeppelin (09/06/2026); a 0.8 ainda é RC        |
| `stellar-access` | `=0.7.2`         | `Ownable`                                                            |
| `stellar-macros` | `=0.7.2`         | `#[only_owner]`                                                      |
| `soroban-sdk`    | `=26.1.0`        | versão usada pela OpenZeppelin 0.7.2                                 |
| Rust             | estável ≥ 1.91.1 | alvo `wasm32v1-none`                                                 |
| Stellar CLI      | 28.x             | linha recomendada pelo Caatinga                                      |
| `@caatinga/cli`  | `^3.12.0`        | linha 3.x é o contrato estável do Caatinga; troca de major é decisão |

Testnet e Pubnet estão no protocolo 29 (consulta `getNetwork` de 03/10/2026). Contratos compilados
com SDK 26 executam em protocolos posteriores.

## 5. Interface

### Tipos

```rust
#[contracttype]
pub struct TicketData {
    pub event_id: BytesN<16>,  // UUID do Event no Postgres
    pub ticket_id: BytesN<16>, // UUID do ingresso no Postgres
    pub checked_in: bool,
    pub transferred: bool,
}

#[contracttype]
pub struct EventData {
    pub capacity: u32,
    pub minted: u32,
}
```

Nenhum campo contém nome, email, documento ou qualquer dado pessoal (RN-010). Tipo de ingresso e
preço ficam só no Postgres.

### Funções

| Função                                                                  | Quem autoriza         | Comportamento                                                                                               |
| ----------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `__constructor(owner: Address, base_uri: String)`                       | deploy                | define o dono e os metadados `Access Tickets` / `ACCESS`                                                    |
| `set_event_capacity(event_id: BytesN<16>, capacity: u32)`               | dono                  | cria ou atualiza; `capacity ≥ max(1, minted)`                                                               |
| `event(event_id: BytesN<16>) -> Option<EventData>`                      | livre                 | leitura                                                                                                     |
| `mint(ticket_id: BytesN<16>, event_id: BytesN<16>, to: Address) -> u32` | dono                  | ID sequencial; idempotente por `ticket_id`; respeita a capacidade                                           |
| `token_of(ticket_id: BytesN<16>) -> Option<u32>`                        | livre                 | leitura                                                                                                     |
| `ticket(token_id: u32) -> TicketData`                                   | livre                 | erro se o token não existe                                                                                  |
| `check_in(token_id: u32)`                                               | dono                  | marca `checked_in`; segunda vez é erro                                                                      |
| `transfer(from: Address, to: Address, token_id: u32)`                   | `from` **e** dono     | regras da seção 6; depois delega a `Base::transfer`                                                         |
| `transfer_from`, `approve`, `approve_for_all`                           | —                     | sempre falham com `OperationNotSupported`                                                                   |
| `set_base_uri(base_uri: String)`                                        | dono                  | o domínio definitivo ainda não existe                                                                       |
| `upgrade(new_wasm_hash: BytesN<32>)`                                    | dono                  | `update_current_contract_wasm`; assinatura compatível com `ctg upgrade`                                     |
| `renounce_ownership`                                                    | —                     | sempre falha: um contrato sem dono não emitiria nem faria check-in                                          |
| demais funções do NFT e do `Ownable`                                    | conforme OpenZeppelin | `balance`, `owner_of`, `name`, `symbol`, `token_uri`, `get_owner`, `transfer_ownership`, `accept_ownership` |

### Regras do mint

1. o evento precisa ter capacidade cadastrada — senão `EventNotRegistered`;
2. se `ticket_id` já foi emitido com o mesmo `event_id` e o mesmo dono atual, devolve o token
   existente sem nova emissão nem evento;
3. se `ticket_id` já existe com outro evento ou outro dono, `TicketConflict`;
4. `minted == capacity` resulta em `CapacityExceeded`;
5. emite com `Base::sequential_mint`, grava `TicketData` e o índice `ticket_id → token_id`, e
   incrementa `minted`.

O destinatário não precisa ter conta ativa na rede (D-23).

### Erros

`#[contracterror]` próprio, com códigos a partir de `1000` para não colidir com os da OpenZeppelin:
`EventNotRegistered`, `InvalidCapacity`, `CapacityExceeded`, `TicketConflict`, `TicketNotFound`,
`AlreadyCheckedIn`, `AlreadyTransferred`, `CheckedInNotTransferable`, `SelfTransfer`,
`OperationNotSupported`.

### Eventos

Além dos eventos de mint e transferência da OpenZeppelin, o contrato publica `event_capacity_set`
(`event_id`, `capacity`) e `checked_in` (`token_id`, `event_id`).

## 6. Regras de transferência

A transferência exige, na mesma invocação, a autorização de `from` (feita por `Base::transfer`) e a
do dono do contrato (D-05). Na prática, o comprador e a plataforma assinam as respectivas
autorizações da mesma transação.

Antes de delegar:

1. o token existe;
2. `checked_in == false` — senão `CheckedInNotTransferable` (RN-002);
3. `transferred == false` — senão `AlreadyTransferred` (D-04);
4. `to != from` — senão `SelfTransfer`.

Depois de `Base::transfer`, `transferred` passa a `true`. A verificação de que `to` é uma conta
válida e ativa na plataforma é feita fora do contrato: a plataforma só co-assina nesse caso (D-04,
D-23). Por isso aprovações e `transfer_from` ficam desativados — eles permitiriam transferir sem a
co-assinatura.

## 7. Armazenamento e TTL

- `TicketData`, índice `ticket_id → token_id` e `EventData` em storage `persistent`;
- toda escrita e leitura dessas chaves estende o TTL para 120 dias quando restar menos de 30;
- o storage `instance` (dono e metadados) é estendido a cada chamada que escreve — a OpenZeppelin
  não faz isso pelo contrato;
- chaves do NFT da OpenZeppelin (`Owner`, `Balance`) têm TTL gerenciado pela própria biblioteca;
- ingresso emitido muito antes do evento pode ser arquivado; desde o protocolo 23 a restauração é
  automática na invocação (`MVP-REVISADO.md` §7).

## 8. Estrutura de arquivos

```
packages/contracts/
├── Cargo.toml                    ← workspace; versões fixadas da seção 4
├── package.json                  ← @access/contracts; scripts do Caatinga, sem test/lint do turbo
├── caatinga.config.ts
├── caatinga.artifacts.json       ← gerado pelo deploy e versionado
└── contracts/ticket/
    ├── Cargo.toml                ← crate ticket_contract
    └── src/
        ├── lib.rs                ← contrato e implementações das traits
        ├── storage.rs            ← chaves, leitura e escrita com TTL
        ├── errors.rs
        ├── events.rs
        └── test.rs
```

`caatinga.config.ts` declara `buildRoot: "."`, o contrato `ticket` com `path` e `wasm`
(`target/wasm32v1-none/release/ticket_contract.wasm`), a rede `testnet` e os `deployArgs` do
construtor: `owner` igual a `STELLAR_SPONSOR_PUBLIC_KEY` e `base_uri` provisório em
`https://access.invalid/tickets/` até existir o domínio.

O `package.json` não expõe `test`, `lint` nem `typecheck`, para o turbo não exigir Rust nos jobs de
Node; os contratos têm job próprio no CI.

## 9. Deploy na Testnet

1. registrar a conta da plataforma como identidade local do Stellar CLI a partir de
   `STELLAR_SPONSOR_SECRET_KEY`, sem gravar a chave em arquivo versionado;
2. `ctg doctor --network testnet --source <identidade>`;
3. `ctg build ticket`;
4. `ctg deploy ticket --network testnet --source <identidade> --no-generate`;
5. versionar `caatinga.artifacts.json`.

Upgrades usam `ctg upgrade ticket --network testnet --source <identidade>`, que mantém o endereço.
Bindings são gerados no bloco 6.

## 10. CI

- o job `contracts` usa o alvo `wasm32v1-none`, instala o Stellar CLI sem compilar do zero e
  verifica o WASM em `packages/contracts/target/wasm32v1-none/release/`;
- mantém o limite próprio de 64 KB por WASM (o da rede é 128 KB);
- `.github/workflows/contracts-deploy.yml` é removido: o deploy é feito pelo Caatinga, e Pubnet é
  etapa explícita.

## 11. Testes

### Unitários (Rust)

- construtor define dono, nome, símbolo e `token_uri`;
- `set_event_capacity`: só o dono; rejeita zero; rejeita abaixo do emitido; aumenta e reduz dentro
  do limite;
- `mint`: só o dono; IDs sequenciais; repetição com os mesmos dados devolve o mesmo token sem nova
  emissão; conflito com outro evento ou dono; evento sem capacidade; capacidade esgotada;
  destinatário que nunca existiu na rede;
- `transfer`: exige as duas autorizações (verificado em `env.auths()`); funciona uma vez; segunda
  falha; falha após check-in; falha para si mesmo; o novo dono aparece em `owner_of`;
- `transfer_from`, `approve`, `approve_for_all` e `renounce_ownership` sempre falham;
- `check_in`: só o dono; segundo check-in falha; token inexistente falha;
- `upgrade` e `set_base_uri`: só o dono;
- TTL das chaves próprias estendido após escrita;
- eventos `event_capacity_set` e `checked_in` publicados.

### Smoke na Testnet

Deploy pelo Caatinga, `set_event_capacity`, `mint` para um endereço nunca ativado, leitura de
`ticket` e `owner_of`, `check_in` e repetição do `mint` confirmando a idempotência. A transferência
com duas assinaturas reais é exercitada no fluxo do comprador, quando o backend assinar pela
plataforma e pelo Privy.

## 12. Definição de pronto

- [ ] Contrato compila para `wasm32v1-none` dentro do limite de 64 KB.
- [ ] Todos os testes unitários da seção 11 passam.
- [ ] Nenhum dado pessoal nos tipos on-chain.
- [ ] Aprovações, `transfer_from` e renúncia de dono desativados.
- [ ] Contrato implantado na Testnet pelo Caatinga, com `caatinga.artifacts.json` versionado.
- [ ] Smoke na Testnet executado.
- [ ] CI compila e testa o contrato; `contracts-deploy.yml` removido.
- [ ] Nada antecipado do bloco 6.
