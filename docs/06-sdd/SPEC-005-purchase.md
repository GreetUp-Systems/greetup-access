# SPEC-005 — Compra do ingresso

> **Status:** 6A implementada; 6B, 6C e 6D pendentes
>
> **Versão:** 1.1
>
> **Atualizada em:** 03/10/2026
>
> **Aprovada em:** 03/10/2026
>
> **Bloco:** 6 do [`OVERVIEW.md`](./OVERVIEW.md) · **Depende de:** SPEC-004 e SPEC-006.
> [Versão anterior arquivada](../_archive/06-sdd/SPEC-005-purchase.md)

## 1. Objetivo

Levar o comprador do ingresso escolhido ao NFT na wallet dele: pedido com reserva de estoque, Pix
pela BlindPay direto para a wallet do produtor, confirmação por webhook, Outbox, fila e mint no
`TicketContract`. Inclui a infraestrutura que a SPEC-001 deixou de fora — relay do Outbox e filas
BullMQ — e a ativação da conta Stellar do comprador (D-23).

## 2. Decisões consumidas

- **D-08/D-09/RN-009:** o payin entrega direto na `bw_...` do produtor; o Access não recebe nada.
- **D-12/RN-014:** sem escrow; reembolso fora do sistema.
- **D-13:** taxa do Access por partner fee da BlindPay.
- **D-14/D-15:** Outbox; workers `OutboxRelay` e `MintTicketWorker` nesta SPEC (`NotifyWorker` no
  bloco 7).
- **D-17:** SSE fica para o bloco 7; aqui o status é consultado por polling.
- **D-21/D-23:** OTP antes do Pix; conta Stellar do comprador ativada no login espontâneo ou após o
  pagamento confirmado.
- **D-24 e ADR-010:** na Testnet, a conta da plataforma assina o mint e paga a taxa; Relayer só na
  etapa de Pubnet.
- **SPEC-004:** só eventos `published` com `startsAt` futuro vendem; soma das quantidades dos tipos ≤
  capacidade.
- **SPEC-006:** `mint` idempotente por `ticket_id`; capacidade on-chain por evento.

## 3. Fatos da BlindPay que restringem o desenho

Verificados na referência oficial e na instância Development em 03/10/2026:

1. `payin.complete` dispara quando a stablecoin já foi entregue na wallet de destino; Pix leva até
   ~5 minutos.
2. Payin criado não pode ser cancelado; não pago, fica `processing` até a BlindPay limpar. O prazo
   dessa limpeza e a validade do `pix_code` não estão documentados.
3. A quote expira em 5 minutos e trava valores, taxas e destino.
4. Valor mínimo de R$ 10 por payin, aplicado na quote; máximo de R$ 100.000.
5. O produtor com KYC standard recebe até US$ 10 mil por transação, 50 mil por dia e 100 mil por mês.
6. O Pix aceita a quote sem `payer_rules`: o CPF do pagador não é exigido pelo schema da API.
7. Estados do payin: `processing`, `on_hold`, `completed`, `failed`, `refunded`; webhooks
   `payin.new`, `payin.update`, `payin.complete`.
8. Em Development, todo payin completa sozinho em ~30 s; `request_amount` 66600 força `failed` e
   77700 força `refunded`.

Os itens 2 e 6 são reconfirmados no smoke real (§14).

## 4. Entrega em quatro partes

Cada parte é um PR próprio, com testes e validação.

| Parte | Conteúdo                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------- |
| 6A    | modelo de compra e ingresso, reserva de estoque, quote e payin, `POST`/`GET` de compra          |
| 6B    | webhooks `payin.*`, transições de pagamento, Outbox `payment.confirmed`, `OutboxRelay` e filas  |
| 6C    | `MintTicketWorker`, sincronização de capacidade on-chain, `ticket.issued`, bindings do contrato |
| 6D    | origem do login no bootstrap e ativação da conta Stellar do comprador                           |

## 5. Invariantes

1. **Nunca vender acima do limite.** Um pedido só cria Pix depois de reservar o estoque, e a reserva
   dura enquanto o payin puder ser pago. A soma das quantidades reservadas e vendidas de um tipo
   nunca excede a quantidade do tipo.
2. Uma compra é de um tipo de ingresso, de 1 a 10 unidades, com total mínimo de R$ 10.
3. Só vendem eventos `published`, com `startsAt` no futuro, de produtor `ready`.
4. `POST /api/purchases` exige `Idempotency-Key`; a mesma chave do mesmo comprador nunca gera um
   segundo payin.
5. O ingresso é emitido só depois de `payin.complete`.
6. Cada ingresso tem UUID próprio, que é o `ticket_id` on-chain; emitir de novo devolve o mesmo
   token (SPEC-006).
7. Toda mudança de estado que gera evento de domínio grava o Outbox na mesma transação.
8. Todo job é idempotente: confere o estado no banco e na rede antes de agir.
9. Nenhum dado pessoal vai à BlindPay além do necessário nem à rede; o comprador não informa CPF.
10. O comprador vê apenas "Taxa de serviço"; a composição fica no banco.

## 6. Estados

### Compra (`PurchaseStatus`)

```
initiated → awaiting_payment → payment_confirmed → ticket_issued
     ↘              ↘ payment_failed
  payment_failed     ↘ payment_refunded
```

| Estado              | Quando                                                      | Reserva estoque               |
| ------------------- | ----------------------------------------------------------- | ----------------------------- |
| `initiated`         | pedido gravado, antes da quote                              | sim, por até 10 min sem payin |
| `awaiting_payment`  | payin criado, Pix disponível                                | sim                           |
| `payment_confirmed` | `payin.complete` recebido; ingressos `pending_mint` criados | sim                           |
| `ticket_issued`     | todos os ingressos emitidos on-chain                        | sim                           |
| `payment_failed`    | erro ao criar quote/payin, ou payin `failed`                | não                           |
| `payment_refunded`  | payin `refunded`                                            | não                           |

Um `initiated` sem payin há mais de 10 minutos deixa de reservar: nenhum Pix chegou ao comprador, e
a quote que o geraria já expirou. Um payin `on_hold` mantém a compra em `awaiting_payment`.

### Ingresso (`TicketStatus`)

`pending_mint → issued`. Check-in, transferência e invalidação entram nos blocos 7 e 8.

### Rótulos para o comprador (frontend)

| Estado              | Rótulo                                 |
| ------------------- | -------------------------------------- |
| `initiated`         | Pedido feito                           |
| `awaiting_payment`  | Aguardando pagamento                   |
| `payment_confirmed` | Pagamento recebido — emitindo ingresso |
| `ticket_issued`     | Pedido concluído                       |
| `payment_failed`    | Pagamento não concluído                |
| `payment_refunded`  | Pagamento devolvido                    |

## 7. Modelo de dados

```prisma
enum PurchaseStatus {
  INITIATED         @map("initiated")
  AWAITING_PAYMENT  @map("awaiting_payment")
  PAYMENT_CONFIRMED @map("payment_confirmed")
  TICKET_ISSUED     @map("ticket_issued")
  PAYMENT_FAILED    @map("payment_failed")
  PAYMENT_REFUNDED  @map("payment_refunded")
}

enum TicketStatus {
  PENDING_MINT @map("pending_mint")
  ISSUED       @map("issued")
}

model Purchase {
  id                 String         @id @default(uuid()) @db.Uuid
  buyerUserId        String         @map("buyer_user_id") @db.Uuid
  producerId         String         @map("producer_id") @db.Uuid
  eventId            String         @map("event_id") @db.Uuid
  ticketTypeId       String         @map("ticket_type_id") @db.Uuid
  quantity           Int
  unitPriceCents     Int            @map("unit_price_cents")
  subtotalCents      Int            @map("subtotal_cents")       // preço dos ingressos
  totalCents         Int?           @map("total_cents")          // sender_amount da quote
  serviceFeeCents    Int?           @map("service_fee_cents")    // total − subtotal
  receiverAmount     BigInt?        @map("receiver_amount")      // stablecoin, unidades mínimas
  blindpayFlatFee    BigInt?        @map("blindpay_flat_fee")
  partnerFeeAmount   BigInt?        @map("partner_fee_amount")
  commercialRate     Decimal?       @map("commercial_rate") @db.Decimal(20, 10)
  blindpayRate       Decimal?       @map("blindpay_rate") @db.Decimal(20, 10)
  externalQuoteId    String?        @unique @map("external_quote_id")
  quoteExpiresAt     DateTime?      @map("quote_expires_at")         // reuso na retomada
  externalPayinId    String?        @unique @map("external_payin_id")
  pixCode            String?        @map("pix_code")
  idempotencyKey     String         @map("idempotency_key") @db.VarChar(128)
  status             PurchaseStatus @default(INITIATED)
  failureCode        String?        @map("failure_code") @db.VarChar(80)
  paymentConfirmedAt DateTime?      @map("payment_confirmed_at")
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  tickets Ticket[]

  @@unique([buyerUserId, idempotencyKey])
  @@index([ticketTypeId, status])
  @@index([producerId, createdAt])
  @@map("purchases")
}

model Ticket {
  id              String       @id @default(uuid()) @db.Uuid  // ticket_id on-chain
  purchaseId      String       @map("purchase_id") @db.Uuid
  producerId      String       @map("producer_id") @db.Uuid
  eventId         String       @map("event_id") @db.Uuid
  ticketTypeId    String       @map("ticket_type_id") @db.Uuid
  ownerUserId     String       @map("owner_user_id") @db.Uuid
  status          TicketStatus @default(PENDING_MINT)
  tokenId         Int?         @unique @map("token_id")
  mintTxHash      String?      @map("mint_tx_hash") @db.VarChar(64)
  issuedAt        DateTime?    @map("issued_at")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  @@index([purchaseId])
  @@index([ownerUserId])
  @@map("tickets")
}
```

Chaves estrangeiras com `Restrict` para usuário, produtor, evento, tipo e compra. `CHECK` no banco:
`quantity BETWEEN 1 AND 10`, `subtotal_cents >= 1000`, `unit_price_cents > 0`.

O `pixCode` é instrução de pagamento, não dado pessoal; fica salvo para o comprador reabrir o Pix.

## 8. Reserva de estoque

Na criação do pedido, numa transação:

1. bloquear a linha do tipo de ingresso (`SELECT ... FOR UPDATE`);
2. somar as quantidades das compras do tipo nos estados que reservam (§6);
3. se `reservado + pedido > quantidade do tipo`, responder `409 ticket_type_sold_out`;
4. gravar a compra `initiated`.

A trava do tipo também é usada pelas edições de tipo da SPEC-004: a quantidade de um tipo nunca
fica abaixo do reservado e vendido, que é o piso que a SPEC-004 deixou para este bloco.

## 9. Fluxo de checkout (6A)

`POST /api/purchases`, autenticado, com `Idempotency-Key`:

```json
{ "ticketTypeId": "uuid", "quantity": 2 }
```

1. resolver comprador, wallet e evento; validar invariantes 2 e 3;
2. reservar (§8); repetição com a mesma chave devolve a compra existente;
3. criar a payin quote: `blockchain_wallet_id` do produtor, `currency_type: "sender"`,
   `request_amount` = subtotal em centavos, `payment_method: "pix"`, `cover_fees: true` (a taxa é
   do comprador), `token` conforme o ambiente (USDB na Testnet), `partner_fee_id` se configurado e
   sem `payer_rules`;
4. criar o payin com a quote, usando `Idempotency-Key` derivada do ID da compra;
5. gravar valores da quote, IDs externos e `pix_code`; compra vai a `awaiting_payment`;
6. responder `201`:

```json
{
  "id": "uuid",
  "status": "awaiting_payment",
  "quantity": 2,
  "subtotalCents": 16000,
  "serviceFeeCents": 980,
  "totalCents": 16980,
  "pixCode": "00020126...",
  "tickets": []
}
```

Falha definitiva na quote ou no payin leva a compra a `payment_failed` com `failureCode` sanitizado e
libera a reserva (`422 payment_rejected`). Erro retryable da BlindPay deixa a compra `initiated` e
responde `503 payment_provider_unavailable`: repetir com a mesma `Idempotency-Key` retoma o pedido,
reaproveitando a quote enquanto restarem mais de 30 segundos de validade. Uma retomada depois dos 10
minutos da reserva marca a compra `payment_failed` (`reservation_expired`) sem criar Pix. Uma quote
cujo `sender_amount` fique abaixo do subtotal é recusada.

Outros erros: `404 ticket_type_not_available`, `409 producer_not_ready_for_sales`,
`409 event_not_on_sale`, `409 ticket_type_sold_out`, `409 idempotency_key_reused`,
`422 purchase_below_minimum`, `400 invalid_purchase` e `400 invalid_idempotency_key`.

`GET /api/purchases/:id` devolve a mesma visão para o comprador dono; compra de outro usuário
responde `404`.

### Boundary BlindPay

O `BlindPayGateway` ganha `createPayinQuote(input)` e `createPayin(quoteId, idempotencyKey)`, com
as mesmas regras do adapter atual: timeout, validação estrita da resposta, `Idempotency-Key` em
mutações, erros sanitizados e nenhum dado sensível em log.

## 10. Pagamento e Outbox (6B)

O endpoint `POST /api/webhooks/blindpay` passa a aceitar `payin.new`, `payin.update` e
`payin.complete`, com a mesma verificação Svix e deduplicação por `svix-id`:

| Evento / status do payin             | Efeito na compra                                                |
| ------------------------------------ | --------------------------------------------------------------- |
| `payin.new`, `processing`, `on_hold` | nada além de registrar a entrega                                |
| `payin.complete` (`completed`)       | `payment_confirmed`, cria os `Ticket` `pending_mint` e o Outbox |
| `failed`                             | `payment_failed`, libera a reserva                              |
| `refunded`                           | `payment_refunded`, libera a reserva                            |

A confirmação grava, na mesma transação, a compra, os ingressos e:

```json
{
  "eventType": "payment.confirmed",
  "aggregateType": "purchase",
  "aggregateId": "purchase-uuid",
  "deduplicationKey": "purchase:{id}:payment_confirmed:v1",
  "payload": { "purchaseId": "purchase-uuid" }
}
```

Payin desconhecido gera alerta sanitizado e `2xx`. Transição para trás (por exemplo `failed` depois
de `completed`) não altera a compra e gera alerta.

### OutboxRelay

- processo no app `workers`, em laço com intervalo curto;
- seleciona eventos `pending` com `FOR UPDATE SKIP LOCKED`, em lote;
- publica cada um na fila correspondente com `jobId` igual ao ID do evento, o que torna a
  republicação inofensiva;
- marca o evento como processado; falha incrementa `attempts` e agenda nova tentativa;
- `payment.confirmed` vai para a fila `tickets`, job `MintTicketJob`; os demais eventos de domínio
  permanecem `pending` até existir consumidor (bloco 7).

## 11. Emissão (6C)

`MintTicketJob { purchaseId }`, com retry e backoff exponencial; esgotadas as tentativas, o job fica
como falho no BullMQ e gera alerta (D-15).

1. carregar a compra; se já `ticket_issued`, encerrar;
2. sincronizar a capacidade on-chain do evento com a do banco quando ausente ou divergente
   (`set_event_capacity`);
3. para cada ingresso `pending_mint`: `mint(ticket_id, event_id, endereço da wallet do comprador)`,
   assinado e pago pela conta da plataforma; gravar `tokenId`, hash e `issued`, com Outbox
   `ticket.issued` (`ticket:{id}:issued:v1`) na mesma transação;
4. com todos emitidos, a compra vai a `ticket_issued`.

Resultado incerto após a submissão é resolvido repetindo o `mint`: o contrato devolve o mesmo token
para o mesmo `ticket_id`. A conta do comprador não precisa estar ativa (D-23, verificado no smoke da
SPEC-006).

Os bindings TypeScript do contrato são gerados por `ctg generate` e versionados. O ID do contrato
vem de `STELLAR_TICKET_CONTRACT_ID`; um teste falha se ele divergir do `caatinga.artifacts.json`.

## 12. Ativação da conta do comprador (6D)

- `POST /api/auth/bootstrap` aceita `{ "origin": "login" | "checkout" }`; `login` registra que o
  usuário entrou por vontade própria (D-23).
- `POST /api/me/stellar/activate`, autenticado e repetível, ativa a conta do usuário com reserva
  patrocinada (`beginSponsoringFutureReserves`, `createAccount`, `endSponsoringFutureReserves`), com
  a assinatura da wallet via Privy usando o JWT do próprio usuário e a da plataforma localmente.
- É elegível quem entrou por login espontâneo ou tem compra `payment_confirmed`/`ticket_issued`.
  Inelegível responde `409 account_activation_not_allowed`.
- A tela de espera chama o endpoint ao ver o pagamento confirmado; se o comprador sair antes, a
  ativação acontece no próximo login ou antes de uma transferência.
- A ativação não roda em worker: a assinatura do usuário exige o JWT dele.
- Produtor continua no fluxo da SPEC-003, que já trata conta ativada no login.

O estado da ativação fica em `wallet_activations` (wallet única, status, hash e código de falha),
com a mesma reconciliação on-chain da SPEC-003.

## 13. Banco, roles e RLS

- `purchases` e `tickets` com `ENABLE`/`FORCE ROW LEVEL SECURITY`;
- comprador lê as próprias compras e ingressos pelo contexto de usuário;
- produtor lê compras e ingressos dos próprios eventos pelo contexto de produtor (somente leitura,
  para os blocos 9 e 12);
- a role do webhook BlindPay ganha leitura e escrita em `purchases`, inserção em `tickets` e
  `outbox_events`, por policies técnicas;
- nova role `access_worker`, `NOBYPASSRLS`, para o app `workers`: lê e marca `outbox_events`, lê
  compras, eventos, tipos e wallets necessários ao mint, atualiza `tickets` e `purchases` e grava
  Outbox `ticket.issued`;
- nenhuma role da aplicação recebe `BYPASSRLS`.

### Leituras cruzadas do checkout

O comprador autenticado precisa de dados de outros tenants: a `bw_...` e a prontidão do produtor, a
linha do tipo de ingresso para travar e as reservas dos demais compradores. Em vez de abrir tabelas,
duas funções `SECURITY DEFINER` fazem exatamente isso:

- `checkout_listing(ticket_type_id)`: destino de pagamento e dados de prontidão de um tipo de evento
  publicado;
- `reserve_purchase(ticket_type_id, quantity, idempotency_key)`: trava o tipo, resolve a chave de
  idempotência, valida evento à venda e mínimo, soma o comprometido e grava a compra `initiated`. O
  comprador vem sempre de `app.current_user_id`, nunca de argumento.

As duas pertencem à role `access_checkout` (`NOLOGIN`, `NOBYPASSRLS`), que tem políticas próprias e
grants apenas no que elas leem; o lock do tipo usa uma política de `UPDATE` com `WITH CHECK (false)`,
que nunca deixa uma linha mudar. A role de runtime só recebe `EXECUTE` nas funções e não tem
`INSERT` em `purchases`.

`committed_ticket_quantity(ticket_type_id)` é a regra única de estoque comprometido, executada com os
direitos de quem chama: a reserva e a edição de quantidade do produtor usam a mesma definição.

## 14. Configuração

```dotenv
STELLAR_TICKET_CONTRACT_ID=CBCO3MQGVHKJ5WRAEGWYI3E3TF4T6L5PNCXSK4MPGVDITIRNRZDPODNT
BLINDPAY_PARTNER_FEE_ID=
DATABASE_URL_WORKER=
```

O app `workers` passa a carregar configuração própria: banco da role `access_worker`, Redis, rede e
signer Stellar (mesmas variáveis e validação fail-closed da SPEC-003) e o ID do contrato.

## 15. Testes

### Unitários

- invariantes 2 e 3 e cálculo de subtotal, total e taxa de serviço;
- mapeamento de estados do payin para a compra, inclusive transição para trás;
- idempotência do `POST` por chave;
- `OutboxRelay`: republicação inofensiva e retry;
- `MintTicketJob`: compra já emitida, ingresso já emitido, capacidade divergente, resultado incerto;
- elegibilidade da ativação.

### Integração (PostgreSQL e Redis reais, providers fakes)

- dois pedidos concorrentes pelo último ingresso: um reserva, o outro recebe `sold_out`;
- `initiated` sem payin há mais de 10 minutos não reserva; `awaiting_payment` reserva sem limite de
  tempo;
- webhook `payin.complete` repetido gera um único `payment.confirmed` e um conjunto de ingressos;
- `failed` e `refunded` liberam a reserva;
- relay entrega o job uma vez mesmo sob dois relays concorrentes;
- worker emite, grava `ticket.issued` e leva a compra a `ticket_issued`; repetido, não duplica;
- comprador A não lê compra de B; produtor lê só vendas dos próprios eventos;
- roles `access_worker` e de webhook acessam só o concedido.

### Smoke (Testnet e BlindPay Development)

Compra real com a `bw_...` de um produtor `ready`, Pix completando sozinho, mint na Testnet,
confirmação de que a quote Pix sem `payer_rules` é aceita, leitura de `sender_amount` com
`cover_fees: true` e decodificação da validade do `pix_code`. Depende do smoke da SPEC-003.

## 16. Definição de pronto

- [x] 6A: pedido, reserva, quote e payin com testes de concorrência.
- [ ] 6B: webhooks de payin, Outbox e `OutboxRelay`, idempotentes.
- [ ] 6C: `MintTicketWorker` emite na Testnet, idempotente, com capacidade sincronizada.
- [ ] 6D: origem do login e ativação da conta do comprador.
- [ ] Nenhuma venda acima do limite em nenhum teste de concorrência.
- [ ] Build, lint, typecheck, unitários e integração passam.
- [ ] Smoke ponta a ponta executado.

## 17. Fora do escopo

- SSE, tela de espera, "meus ingressos", QR Code e `NotifyWorker` — bloco 7;
- check-in — bloco 8;
- transferência entre contas — depois do bloco 7;
- saldo, saque e conciliação de taxas — bloco 9;
- Relayer e Pubnet;
- reembolso pelo sistema.
