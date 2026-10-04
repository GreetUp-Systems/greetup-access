# SPEC-008 — Área do comprador

> **Status:** aprovada; implementação não iniciada
>
> **Versão:** 1.0
>
> **Atualizada em:** 04/10/2026
>
> **Aprovada em:** 04/10/2026
>
> **Bloco:** 7 do [`OVERVIEW.md`](./OVERVIEW.md) · **Depende de:** SPEC-005.
> [Versão anterior arquivada](../_archive/06-sdd/SPEC-008-ticket-read.md)

## 1. Objetivo

Dar ao comprador o que acontece depois do Pix: acompanhar o pedido em tempo real, ver os próprios
ingressos com o QR Code de entrada e receber um e-mail quando os ingressos ficam prontos.

Esta SPEC entrega **só a API e o worker**. As telas (tela de espera, "meus ingressos") entram na
SPEC do app web, junto com a base do Next.js, a página do evento e o checkout.

## 2. Decisões consumidas

- **D-14/D-15:** `ticket.issued` já é gravado no Outbox pela SPEC-005; o `NotifyWorker` é o
  consumidor dele.
- **D-16:** leitura direta do Postgres, sem cache nem CQRS; Redis só para o BullMQ.
- **D-17:** realtime só por SSE e só na tela de espera.
- **D-19:** check-in online no MVP; validação do QR é do bloco 8.
- **D-04:** transferência única, depois deste bloco; o QR já nasce preso ao dono atual.
- **D-23 e SPEC-005 §12:** a tela de espera chama `POST /api/me/stellar/activate` quando vê o
  pagamento confirmado.
- **RN-010:** nada pessoal on-chain; e-mail e nome ficam no Postgres.

## 3. Entrega em duas partes

| Parte | Conteúdo                                                                           |
| ----- | ---------------------------------------------------------------------------------- |
| 7A    | `GET /api/me/tickets`, `GET /api/me/tickets/:id` com QR assinado, SSE do pedido    |
| 7B    | `NotifyWorker`: e-mail "seus ingressos estão prontos" via Resend, roteado do relay |

Cada parte é um PR próprio.

## 4. Invariantes

1. **O QR só existe para ingresso emitido.** Ingresso `pending_mint` não tem token.
2. **O QR é do dono atual.** A assinatura cobre o ingresso e o dono; trocar o dono invalida o QR
   anterior sem estado extra.
3. **O QR não sai da área autenticada.** Nem e-mail nem página pública carregam o token.
4. **Um e-mail por compra.** Uma compra com vários ingressos gera uma única notificação, mesmo com
   eventos `ticket.issued` repetidos, fora de ordem ou concorrentes.
5. **Comprador só vê o que é dele.** Toda leitura passa pelo contexto de usuário e RLS.

## 5. Meus ingressos (7A)

### `GET /api/me/tickets`

Lista os ingressos cujo `owner_user_id` é o usuário autenticado, ordenados pela data do evento e
depois pela emissão. Sem paginação no MVP, com teto de 200 itens.

```json
{
  "tickets": [
    {
      "id": "uuid",
      "status": "issued",
      "event": { "id": "uuid", "slug": "show", "name": "Show", "startsAt": "ISO-8601" },
      "ticketType": { "id": "uuid", "name": "Pista" },
      "purchaseId": "uuid",
      "issuedAt": "ISO-8601 | null",
      "onchain": {
        "tokenId": 7,
        "transactionHash": "hex | null",
        "explorerUrl": "https://stellar.expert/explorer/testnet/tx/<hash> | null"
      }
    }
  ]
}
```

`onchain` é `null` enquanto o ingresso estiver `pending_mint`. O link do explorer usa a rede de
`STELLAR_NETWORK`; o contrato vem de `STELLAR_TICKET_CONTRACT_ID`, que a API passa a ler.

### `GET /api/me/tickets/:id`

O mesmo item, mais `qrToken` (string) quando `status = issued`, senão `null`. Ingresso de outro
usuário ou inexistente responde `404 ticket_not_found` — o RLS esconde a linha e não há como
distinguir os casos.

Os dados do evento e do tipo vêm de policies de leitura para o dono do ingresso, não de abertura
geral das tabelas.

## 6. QR Code assinado (7A)

Formato do token:

```text
AT1.<ticket_id sem hífens, 32 hex>.<HMAC-SHA256 em base64url, 43 caracteres>
```

- mensagem assinada: `access-ticket-qr:v1:<ticket_id>:<owner_user_id>`;
- chave: `TICKET_QR_SECRET`, com pelo menos 32 bytes de entropia, validada no startup;
- o token não expira; quem decide a entrada é o check-in online do bloco 8 (o primeiro scan vale);
- o cliente desenha o QR a partir do token; o backend não gera imagem;
- `TicketQrService` expõe `sign(ticketId, ownerUserId): string` e
  `parse(token): { ticketId: string; signature: Buffer } | null`, e
  `verify(token, ownerUserId): boolean` em tempo constante. Esta SPEC só emite; o uso de `verify`
  na entrada é do bloco 8.

Trocar `TICKET_QR_SECRET` invalida todos os QR emitidos: é o procedimento de revogação em massa,
não uma rotação transparente.

Risco aceito no MVP: um print do QR funciona até o primeiro uso.

## 7. SSE do pedido (7A)

### `GET /api/purchases/:id/stream`

- `text/event-stream`, autenticado pelo mesmo `Authorization: Bearer` das outras rotas. O
  `EventSource` do navegador não envia esse header; o front consome com `fetch` streaming
  (por exemplo `@microsoft/fetch-event-source`).
- Compra de outro usuário ou inexistente responde `404` antes de abrir o stream.
- Cada conexão consulta a compra no contexto do usuário a cada 2 s e emite `status` só quando o
  estágio muda; a primeira mensagem sai na abertura.
- `heartbeat` a cada 15 s, para proxies não derrubarem a conexão ociosa.
- Fecha depois de emitir um estágio final (`ticket_issued` ou `not_completed`) ou após 15 minutos,
  emitindo `timeout`; o cliente então consulta `GET /api/purchases/:id`.
- Desconexão do cliente encerra o polling daquela conexão.

Mensagem `status`:

```json
{ "purchaseId": "uuid", "stage": "awaiting_payment", "status": "awaiting_payment" }
```

| `status` interno    | `stage` para o comprador |
| ------------------- | ------------------------ |
| `initiated`         | `order_placed`           |
| `awaiting_payment`  | `awaiting_payment`       |
| `payment_confirmed` | `payment_confirmed`      |
| `ticket_issued`     | `ticket_issued`          |
| `payment_failed`    | `not_completed`          |
| `payment_refunded`  | `not_completed`          |

Os textos exibidos ("pedido feito", "pagamento confirmado, emitindo ingresso"…) são do front.

## 8. NotifyWorker (7B)

### Roteamento

O `OutboxRelay` passa a rotear `ticket.issued` para a fila `notifications`, job `SendTicketsReadyJob`,
com `jobId` igual ao id do evento do Outbox, como o mint. Mesma política: 8 tentativas, backoff
exponencial, concorrência 1.

### Processamento

1. Carrega o ingresso e a compra. Se algum ingresso da compra ainda está `pending_mint`, termina sem
   fazer nada: o evento do último ingresso emitido fará o envio. O último ingresso é gravado
   `issued` na mesma transação do seu `ticket.issued`, então quando esse evento é processado todos
   já estão emitidos.
2. Insere `email_notifications (kind = tickets_ready, reference_id = purchase_id)` com
   `ON CONFLICT DO NOTHING`; se a linha já está `sent`, termina.
3. Envia pelo Resend com `Idempotency-Key: tickets-ready:<purchase_id>`. Dois jobs concorrentes da
   mesma compra resultam num único e-mail: o Resend deduplica a chave por 24 h, e a linha deduplica
   para sempre depois de `sent`.
4. Grava `sent`, `provider_message_id` e `sent_at`.

Erros: rede, `429` e `5xx` são tentados de novo; demais `4xx` gravam `failed` com o código e
encerram com `UnrecoverableError`. Logs nunca incluem o e-mail do destinatário.

### Conteúdo

E-mail em pt-BR, HTML e texto: nome e data do evento (fuso `America/Sao_Paulo`), tipo, quantidade e
link `APP_PUBLIC_URL/me/tickets`. Sem QR (invariante 3) e sem valores.

### Desligado em development

Com `RESEND_API_KEY`, `EMAIL_FROM` e `APP_PUBLIC_URL` vazios, o worker não registra a fila e o relay
não roteia `ticket.issued`: os eventos ficam pendentes no Outbox e são entregues quando o envio for
ligado. Preencher só parte das três é erro de configuração. Em `production` as três são obrigatórias.

Antes de verificar um domínio, o Resend só entrega do remetente de teste para o e-mail dono da
conta.

## 9. Modelo de dados

```prisma
model EmailNotification {
  id                String                  @id @default(uuid()) @db.Uuid
  kind              EmailNotificationKind
  referenceId       String                  @map("reference_id") @db.Uuid
  userId            String                  @map("user_id") @db.Uuid
  status            EmailNotificationStatus @default(PENDING)
  providerMessageId String?                 @map("provider_message_id") @db.VarChar(64)
  failureCode       String?                 @map("failure_code") @db.VarChar(80)
  sentAt            DateTime?               @map("sent_at")
  createdAt         DateTime                @default(now()) @map("created_at")
  updatedAt         DateTime                @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([kind, referenceId])
  @@map("email_notifications")
}

enum EmailNotificationKind {
  TICKETS_READY @map("tickets_ready")
}

enum EmailNotificationStatus {
  PENDING @map("pending")
  SENT    @map("sent")
  FAILED  @map("failed")
}
```

A tabela guarda só metadados; o corpo do e-mail não é persistido.

## 10. Banco, roles e RLS

- `email_notifications` com `ENABLE`/`FORCE ROW LEVEL SECURITY`; só `access_worker` tem acesso
  (`SELECT`, `INSERT`, `UPDATE`); a API não lê a tabela.
- `access_worker` ganha leitura de `users` restrita às colunas `id` e `email`, e de `ticket_types`
  (nome), por policies técnicas.
- runtime da API: policies de leitura em `events` e `ticket_types` para quem é dono de um ingresso
  deles, no contexto de usuário.
- nenhuma role ganha `BYPASSRLS`.

## 11. Configuração

```dotenv
# API
TICKET_QR_SECRET=
# Workers — vazias em development desligam o envio
RESEND_API_KEY=
EMAIL_FROM=
APP_PUBLIC_URL=
```

`STELLAR_TICKET_CONTRACT_ID` já existe e passa a ser lida também pela API.

## 12. Testes

### Unitários

- `TicketQrService`: token assinado e verificado; adulterado, outro dono, outro segredo e formato
  inválido falham;
- mapeamento `status` → `stage`;
- `NotifyWorker`: compra com ingresso pendente não envia; linha `sent` não reenvia; `4xx` falha sem
  retry; `5xx` e `429` tentam de novo;
- configuração: e-mail parcialmente preenchido é erro; `production` exige as três variáveis.

### Integração (PostgreSQL e Redis reais, Resend fake)

- comprador A lista só os próprios ingressos; `GET` de ingresso de B responde `404`;
- `qrToken` só para ingresso `issued`;
- SSE emite o estágio inicial, a mudança para `ticket_issued` e fecha; compra de outro usuário
  responde `404`;
- compra com três ingressos gera um único e-mail, inclusive com os três jobs processados e um
  repetido;
- relay roteia `ticket.issued` só com o envio ligado;
- `access_worker` não lê colunas de `users` além de `id` e `email`.

### Smoke

E-mail real pelo Resend no smoke ponta a ponta da compra (SPEC-005 §15).

## 13. Definição de pronto

- [ ] 7A: meus ingressos, QR assinado e SSE, com testes.
- [ ] 7B: `NotifyWorker` com um e-mail por compra, idempotente, com testes.
- [ ] Build, lint, typecheck, unitários e integração passam.
- [ ] E-mail real entregue no smoke ponta a ponta.

## 14. Fora do escopo

- telas e app web — SPEC própria, a seguir;
- validação do QR na entrada e check-in — bloco 8;
- transferência — depois deste bloco;
- e-mail de cancelamento ou adiamento de evento — com o cancelamento da SPEC-004;
- imagem do QR no backend, paginação, preferências de notificação.
