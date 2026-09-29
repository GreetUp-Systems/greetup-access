# SPEC-004 — Events (CRUD de Eventos e Ticket Types)

> ⚠️ **Válida, com resíduo** — o cancelamento ainda chama `EscrowContract.block()`; não há escrow (D-12), cancelamento é tratado por contrato e relacionamento (RN-014). Em qualquer conflito, vale o [MVP-REVISADO.md](./MVP-REVISADO.md).

**Objetivo:** Implementar criação, edição e publicação de eventos, tipos de ingresso e políticas de reembolso. Página pública do evento.

**Pré-requisitos:** SPEC-001, SPEC-002, SPEC de organizations (bloco 3 do OVERVIEW.md — a versão anterior foi arquivada)

**Tempo estimado:** 1 dia

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── events/
│   ├── events.module.ts
│   ├── events.controller.ts
│   ├── events.service.ts
│   ├── ticket-types/
│   │   ├── ticket-types.controller.ts
│   │   └── ticket-types.service.ts
│   ├── dto/
│   │   ├── create-event.dto.ts
│   │   ├── update-event.dto.ts
│   │   ├── create-ticket-type.dto.ts
│   │   └── refund-policy.dto.ts
│   └── __tests__/
│       ├── events.service.spec.ts
│       └── events.integration.spec.ts
apps/web/
└── app/
    └── events/
        └── [slug]/
            └── page.tsx             ← página pública do evento (SSR)
```

---

## 2. DTOs e tipos

```typescript
// dto/refund-policy.dto.ts
export class RefundPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  fullRefundDaysBefore?: number;    // dias antes para reembolso 100%

  @IsOptional()
  @IsInt()
  @Min(0)
  partialRefundDaysBefore?: number; // dias antes para reembolso parcial

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  partialRefundPercent?: number;    // percentual do reembolso parcial

  @IsBoolean()
  allowRefundAfterCheckin: boolean; // sempre false no MVP
}

// dto/create-event.dto.ts
export class CreateEventDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() location?: string;
  @IsISO8601() eventDate: string;
  @IsInt() @Min(1) capacityMax: number;
  @IsInt() @Min(1) @Default(7) securityWindowDays: number;
  @ValidateNested() @Type(() => RefundPolicyDto) refundPolicy: RefundPolicyDto;
  @IsOptional() @IsUrl() coverImageUrl?: string;
}

// dto/create-ticket-type.dto.ts
export class CreateTicketTypeDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsDecimal({ decimal_digits: "0,2" }) priceBrl: string;
  @IsInt() @Min(1) quantityTotal: number;
  @IsBoolean() @Default(false) transferable: boolean;
}
```

---

## 3. EventsService — assinaturas

```typescript
@Injectable()
export class EventsService {
  // Cria evento em status DRAFT
  async create(dto: CreateEventDto, organizationId: string): Promise<Event>;

  // Publica evento (DRAFT → PUBLISHED)
  // Valida: tem pelo menos 1 ticket type, data no futuro, capacidade > 0
  async publish(eventId: string, organizationId: string): Promise<Event>;

  // Cancela evento — chama EscrowContract.block() e invalida tickets
  async cancel(eventId: string, organizationId: string): Promise<void>;

  // Adia evento — atualiza data, mantém tickets válidos
  async postpone(eventId: string, newDate: Date, organizationId: string): Promise<Event>;

  // Busca por slug (público, sem RLS)
  async findBySlug(slug: string): Promise<EventPublicView>;

  // Lista eventos da organização (com RLS)
  async findByOrganization(organizationId: string): Promise<Event[]>;

  // Busca evento por ID com verificação de ownership
  async findOne(eventId: string, organizationId: string): Promise<Event>;

  // Gera slug único a partir do nome
  private generateSlug(name: string): string;
}

// Interface para a página pública (sem dados sensíveis)
export interface EventPublicView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  eventDate: Date;
  capacityMax: number;
  status: EventStatus;
  coverImageUrl: string | null;
  refundPolicy: RefundPolicy;
  ticketTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    priceBrl: string;
    quantityTotal: number;
    quantitySold: number;
    available: number;
    transferable: boolean;
  }>;
}
```

---

## 4. Endpoints

### POST /events
```
Auth: produtor com KYB aprovado e org ACTIVE
Body: CreateEventDto
Response 201: Event (status: DRAFT)
```

### POST /events/:id/publish
```
Auth: produtor owner do evento
Response 200: Event (status: PUBLISHED)
Erros: 400 se sem ticket types, data passada ou capacidade 0
```

### GET /events/:slug (público)
```
Auth: nenhuma
Response 200: EventPublicView
```

### GET /events (listagem do produtor)
```
Auth: produtor
Response 200: Event[]
Filtros query: status?, page?, limit?
```

### POST /events/:id/ticket-types
```
Auth: produtor owner do evento (status DRAFT)
Body: CreateTicketTypeDto
Response 201: TicketType
```

### POST /events/:id/cancel
```
Auth: produtor ou admin
Response 200: { success: true }
Side effects: bloqueia escrow, invalida tickets, notifica compradores
Publica domain event: event.cancelled
```

---

## 5. Testes esperados

### Unitários
- `EventsService.create` gera slug único a partir do nome
- `EventsService.publish` lança BadRequestException sem ticket types
- `EventsService.publish` lança BadRequestException com data no passado
- `EventsService.cancel` publica domain event `event.cancelled` via OutboxService
- `generateSlug` normaliza acentos e espaços corretamente

### Integração
- `POST /events` cria evento em DRAFT com RLS correto
- `GET /events/:slug` retorna evento público sem autenticação
- `POST /events/:id/publish` transiciona para PUBLISHED
- `POST /events/:id/ticket-types` adiciona ticket type ao evento
- Produtor de outra org não consegue acessar eventos de outra org (RLS)

---

## 6. Definição de Pronto

- [ ] CRUD de eventos funcional com RLS
- [ ] Página pública do evento acessível sem autenticação
- [ ] Publicação valida pré-condições
- [ ] Cancelamento publica domain event
- [ ] Slug gerado automaticamente e único
- [ ] Todos os testes passam
