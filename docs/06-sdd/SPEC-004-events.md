# SPEC-004 — Eventos e tipos de ingresso

> **Status:** aprovada; implementação não iniciada
>
> **Versão:** 2.0
>
> **Atualizada em:** 02/10/2026
>
> **Aprovada em:** 02/10/2026
>
> **Depende de:** [`SPEC-003`](./SPEC-003-producer.md) — `ProducerProfile`, RLS por produtor e
> estado derivado `ready`. [Versão anterior arquivada](../_archive/06-sdd/SPEC-004-events.md)

## 1. Objetivo

Permitir que o produtor monte seus eventos e tipos de ingresso, publique-os quando puder vender e
exponha uma leitura pública do evento publicado.

Ao final desta SPEC, a API deve conseguir:

1. criar, editar, listar e apagar eventos em rascunho do produtor autenticado;
2. criar, editar e apagar tipos de ingresso de um evento;
3. publicar um evento somente quando o produtor estiver `ready`;
4. editar um evento publicado dentro das regras da seção 5;
5. cancelar um evento publicado, gravando `event.cancelled` no Outbox na mesma transação;
6. servir a leitura pública de eventos publicados e cancelados por slug, sem autenticação;
7. impedir, também no banco, que um produtor leia ou altere eventos de outro.

## 2. Decisões consumidas

- Tenancy por `producerId` (D-20, ADR-009): não existem `Organization`, `Membership` nem papel de
  admin. O produtor é derivado da identidade autenticada, nunca do body ou da rota.
- Não há escrow nem retenção (D-12). Cancelamento é tratado por contrato e relacionamento (RN-014);
  no sistema, ele é uma mudança de estado mais o evento de domínio `event.cancelled` (D-14).
- Todo ingresso pode ser transferido uma única vez (RN-006, D-04). Não existe flag de transferência
  por tipo de ingresso.
- A política de reembolso é texto livre do produtor, exibido antes da compra (RN-008). O sistema não
  calcula nem executa reembolso, e o texto não se sobrepõe ao direito de arrependimento do CDC.
- Nada on-chain neste bloco. Vínculo do evento com o contrato e limite de capacidade na rede
  (RN-003) pertencem ao bloco 5.

## 3. Escopo

### Inclui

- modelo `Event` e `TicketType`, migration e RLS;
- endpoints privados de gestão do produtor e endpoint público por slug;
- geração de slug;
- validações de publicação e de edição pós-publicação;
- cancelamento com Outbox.

### Fora do escopo

- telas Next.js, inclusive a página pública — o frontend terá bloco próprio;
- imagem de capa e upload de arquivos;
- ingresso gratuito (preço zero): exige emissão fora do fluxo Pix/BlindPay;
- data de término, janela de vendas por tipo e fuso horário por evento;
- disponibilidade e quantidade vendida — entram com a compra (bloco 6);
- notificação de compradores sobre adiamento ou cancelamento — entra com o `NotifyWorker`;
- invalidação de ingressos no cancelamento — consumidor de `event.cancelled` em bloco futuro;
- registro do evento no contrato Soroban (bloco 5);
- paginação e busca pública de eventos (marketplace fora do MVP).

## 4. Invariantes

1. Todo `Event` e `TicketType` pertence a exatamente um produtor; o `producer_id` vem do contexto
   autenticado.
2. Um evento só passa de `draft` para `published` se o produtor estiver `ready` no momento da
   publicação.
3. Publicação exige: ao menos um tipo de ingresso, `startsAt` no futuro e soma das quantidades dos
   tipos menor ou igual a `capacity`.
4. A soma das quantidades dos tipos nunca excede `capacity` depois da publicação.
5. Evento `cancelled` é terminal: não aceita edição, publicação nem novos tipos.
6. Evento `published` não volta para `draft` e não pode ser apagado; tipos de ingresso de evento
   publicado não podem ser apagados.
7. O slug é único no sistema e fica imutável a partir da publicação.
8. `event.cancelled` é gravado uma única vez por evento, na mesma transação da mudança de estado.
9. Publicar, editar e apagar não geram evento de domínio.
10. A leitura pública nunca expõe rascunho, `producerId`, dados do produtor além do necessário à
    página nem campos internos.

## 5. Estados e regras de edição

```
draft ──publish──▶ published ──cancel──▶ cancelled
  │
  └──delete──▶ (removido)
```

"Encerrado" não é estado: é derivado de `startsAt` no passado.

| Campo                                   | `draft`        | `published`                            | `cancelled` |
| --------------------------------------- | -------------- | -------------------------------------- | ----------- |
| `name`                                  | editável       | editável                               | —           |
| `slug`                                  | segue o `name` | imutável                               | —           |
| `description`, `location`               | editável       | editável                               | —           |
| `startsAt`                              | editável       | editável, sempre no futuro (adiamento) | —           |
| `refundPolicy`                          | editável       | editável                               | —           |
| `capacity`                              | editável       | editável, ≥ soma das quantidades       | —           |
| tipo de ingresso — criar                | sim            | sim                                    | —           |
| tipo de ingresso — `name`/`description` | editável       | editável                               | —           |
| tipo de ingresso — `priceCents`         | editável       | editável; vale para vendas futuras     | —           |
| tipo de ingresso — `quantity`           | editável       | editável, ≥ vendido¹                   | —           |
| tipo de ingresso — apagar               | sim            | não                                    | —           |
| evento — apagar                         | sim            | não                                    | não         |

¹ Quantidade vendida só existe a partir do bloco 6. Até lá o piso é zero; a SPEC de compra adiciona
a verificação contra o vendido.

O adiamento é uma edição de `startsAt`, sem endpoint próprio.

## 6. Modelo de dados

```prisma
enum EventStatus {
  DRAFT     @map("draft")
  PUBLISHED @map("published")
  CANCELLED @map("cancelled")
}

model Event {
  id           String      @id @default(uuid()) @db.Uuid
  producerId   String      @map("producer_id") @db.Uuid
  slug         String      @unique @db.VarChar(100)
  name         String      @db.VarChar(120)
  description  String?     @db.VarChar(5000)
  location     String?     @db.VarChar(200)
  startsAt     DateTime    @map("starts_at") @db.Timestamptz(3)
  capacity     Int
  refundPolicy String?     @map("refund_policy") @db.VarChar(2000)
  status       EventStatus @default(DRAFT)
  publishedAt  DateTime?   @map("published_at")
  cancelledAt  DateTime?   @map("cancelled_at")
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  producer    ProducerProfile @relation(fields: [producerId], references: [id], onDelete: Restrict)
  ticketTypes TicketType[]

  @@unique([id, producerId])
  @@index([producerId, createdAt])
  @@map("events")
}

model TicketType {
  id          String   @id @default(uuid()) @db.Uuid
  eventId     String   @map("event_id") @db.Uuid
  producerId  String   @map("producer_id") @db.Uuid
  name        String   @db.VarChar(80)
  description String?  @db.VarChar(500)
  priceCents  Int      @map("price_cents")
  quantity    Int
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  event Event @relation(fields: [eventId, producerId], references: [id, producerId], onDelete: Restrict)

  @@index([eventId])
  @@map("ticket_types")
}
```

`ticket_types.producer_id` é redundante de propósito: permite a policy de RLS sem subconsulta nas
escritas, e a FK composta `(event_id, producer_id)` garante que ele sempre coincide com o do evento.

A migration adiciona `CHECK` no banco para `capacity > 0`, `quantity > 0` e `price_cents > 0`.

Apagar evento em rascunho remove seus tipos na mesma transação; a FK continua `Restrict` para impedir
remoção implícita.

## 7. RLS

As duas tabelas usam `ENABLE` e `FORCE ROW LEVEL SECURITY`, com grants somente para
`access_app_runtime`. A role do webhook BlindPay não recebe acesso.

| Tabela         | Policy                            | Comando  | Regra                                                                         |
| -------------- | --------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `events`       | `events_producer_isolation`       | `ALL`    | `producer_id = app.current_producer_id` em `USING` e `WITH CHECK`             |
| `events`       | `events_public_read`              | `SELECT` | `status IN ('published', 'cancelled')`                                        |
| `ticket_types` | `ticket_types_producer_isolation` | `ALL`    | `producer_id = app.current_producer_id` em `USING` e `WITH CHECK`             |
| `ticket_types` | `ticket_types_public_read`        | `SELECT` | existe evento com o mesmo `event_id` e `status IN ('published', 'cancelled')` |

A leitura pública roda sem contexto de produtor; só as policies `*_public_read` se aplicam.
Escritas continuam exigindo `withProducerContext`. Uma policy de leitura pública nunca concede
`INSERT`, `UPDATE` ou `DELETE`.

Toda transição de estado e toda edição que dependa de soma de quantidades bloqueia a linha do evento
(`SELECT ... FOR UPDATE`) dentro da transação, para que publicação, edição de tipos e cancelamento
concorrentes não violem as invariantes 3 e 4.

## 8. Contratos HTTP

Todas as rotas abaixo são privadas e exigem `ProducerProfile`, exceto a pública. Respostas privadas
não incluem `producerId`. Preços sempre em centavos de BRL.

### `POST /api/events`

```json
{
  "name": "Festival Access",
  "description": "…",
  "location": "Rua Exemplo, 100 — São Paulo/SP",
  "startsAt": "2026-12-12T20:00:00-03:00",
  "capacity": 300,
  "refundPolicy": "Reembolso integral até 7 dias antes do evento."
}
```

Cria o evento em `draft` e gera o slug. Não exige `ready`. Retorna `201` com a visão privada.

### `GET /api/events?status=draft|published|cancelled`

Lista os eventos do produtor autenticado, mais recentes primeiro, sem paginação.

### `GET /api/events/:id`

Visão privada do evento com seus tipos. Evento de outro produtor responde `404`.

### `PATCH /api/events/:id`

Edita os campos da seção 5 conforme o estado. Campos não permitidos no estado atual retornam
`409 event_field_locked`; evento cancelado retorna `409 event_cancelled`.

### `DELETE /api/events/:id`

Somente `draft`. Retorna `204`; em outro estado, `409 event_not_draft`.

### `POST /api/events/:id/publish`

Valida as invariantes 2 e 3 e publica. Erros:

- `409 producer_not_ready` — produtor ainda não está `ready`;
- `422 event_without_ticket_types`;
- `422 event_starts_in_past`;
- `422 ticket_quantity_exceeds_capacity`.

Repetir em evento já publicado retorna `200` com o estado atual; em evento cancelado, `409 event_cancelled`.

### `POST /api/events/:id/cancel`

Somente `published`. Muda para `cancelled`, grava `cancelledAt` e o Outbox na mesma transação.
Repetir em evento já cancelado retorna `200` sem novo Outbox; em `draft`, `409 event_not_published`
(rascunho é apagado, não cancelado).

### `POST /api/events/:id/ticket-types`

```json
{ "name": "Pista", "description": "…", "priceCents": 8000, "quantity": 200 }
```

Retorna `201`. Em evento publicado, valida a invariante 4.

### `PATCH /api/events/:id/ticket-types/:ticketTypeId`

Edita conforme a seção 5.

### `DELETE /api/events/:id/ticket-types/:ticketTypeId`

Somente com o evento em `draft`; caso contrário, `409 ticket_type_locked`.

### `GET /api/public/events/:slug` — pública

Rota marcada com `@Public()`. Retorna eventos `published` e `cancelled`; rascunho ou slug inexistente
respondem `404` idêntico.

```json
{
  "slug": "festival-access",
  "name": "Festival Access",
  "description": "…",
  "location": "Rua Exemplo, 100 — São Paulo/SP",
  "startsAt": "2026-12-12T23:00:00.000Z",
  "status": "published",
  "refundPolicy": "Reembolso integral até 7 dias antes do evento.",
  "producer": { "displayName": "Festival Access" },
  "ticketTypes": [{ "id": "uuid", "name": "Pista", "description": "…", "priceCents": 8000 }]
}
```

`capacity` e `quantity` não são expostos; a disponibilidade entra com o bloco 6. `displayName` é o
nome de produto do produtor, não nome legal (SPEC-003 §13).

### Validação de entrada

Schemas zod, como em `producer-onboarding.schemas.ts`:

- `name`: 1 a 120 caracteres após `trim`;
- `description`: até 5.000; `location`: até 200; `refundPolicy`: até 2.000;
- `startsAt`: ISO 8601 com offset; na criação e na publicação, precisa estar no futuro;
- `capacity`, `quantity`: inteiros ≥ 1;
- `priceCents`: inteiro ≥ 1;
- campos desconhecidos são rejeitados.

A exibição em horário de Brasília é responsabilidade do frontend; a API trabalha em UTC.

## 9. Slug

1. normalizar o `name`: NFD, remover diacríticos, minúsculas, trocar o que não for `a-z0-9` por `-`,
   colapsar e aparar hífens, limitar a 80 caracteres;
2. nome que resulte vazio usa `evento`;
3. em colisão, acrescentar `-` e 6 caracteres aleatórios `a-z0-9`, repetindo até inserir;
4. a unicidade é garantida pelo índice único; a colisão é tratada pelo erro de violação, não por
   consulta prévia;
5. em `draft`, editar `name` regenera o slug; a partir da publicação ele não muda.

## 10. Outbox

No cancelamento, a mesma transação grava:

```json
{
  "eventType": "event.cancelled",
  "aggregateType": "event",
  "aggregateId": "event-uuid",
  "deduplicationKey": "event:{id}:cancelled:v1",
  "payload": { "eventId": "event-uuid", "producerId": "producer-uuid" }
}
```

O payload não contém nome do evento, local nem dados do produtor.

## 11. Estado `ready`

A publicação usa a mesma derivação de `onboardingStatus` da SPEC-003. A função de derivação sai de
`ProducersService` para um helper compartilhado, consumido pelos dois serviços, sem duplicar regra.

## 12. Estrutura de arquivos

Segue o padrão de `apps/api/src/producers`:

```
apps/api/src/events/
├── events.module.ts
├── events.controller.ts           ← rotas privadas
├── public-events.controller.ts    ← rota pública
├── events.service.ts
├── events.service.spec.ts
├── events.repository.ts
├── events.schemas.ts
├── events.types.ts
├── event-slug.ts
└── event-slug.spec.ts
apps/api/test/events.integration.spec.ts
packages/database/prisma/migrations/<timestamp>_events/migration.sql
```

## 13. Testes

### Unitários

- slug: acentos, espaços, símbolos, nome vazio, limite de tamanho;
- publicação rejeita produtor não `ready`, evento sem tipos, data passada e quantidades acima da
  capacidade;
- edição respeita a tabela da seção 5 em cada estado;
- cancelamento grava um único Outbox, com payload sem dados do evento além dos IDs;
- schemas rejeitam campos desconhecidos, preço zero, capacidade zero e datas sem offset.

### Integração

Com PostgreSQL real e a role de runtime:

- produtor A não lê, edita, publica, cancela nem cria tipo no evento de B, mesmo omitindo filtro;
- leitura sem contexto vê somente eventos publicados e cancelados, e os tipos deles;
- rota pública devolve `404` idêntico para rascunho e slug inexistente;
- rascunho criado antes do KYC; publicação bloqueada até `ready` e liberada depois;
- dois cancelamentos concorrentes geram um único Outbox;
- publicação concorrente com aumento de quantidade não deixa a soma acima da capacidade;
- colisão de slug gera sufixo e preserva unicidade;
- slug não muda ao editar `name` de evento publicado;
- apagar rascunho remove os tipos; apagar publicado é recusado;
- `CHECK` do banco recusa capacidade, quantidade e preço não positivos.

## 14. Definição de pronto

- [ ] Produtor cria rascunho sem estar `ready` e só publica quando `ready`.
- [ ] Regras de edição por estado da seção 5 cobertas por testes.
- [ ] RLS isola produtores com a role real de runtime, e a leitura pública expõe só publicados e
      cancelados.
- [ ] Cancelamento grava `event.cancelled` exatamente uma vez, na mesma transação.
- [ ] Slug único, estável após publicação.
- [ ] Nenhum dado interno ou de outro produtor na rota pública.
- [ ] Build, lint, typecheck, unitários e integração passam.
- [ ] Nenhuma antecipação dos blocos 5, 6 ou do frontend.
