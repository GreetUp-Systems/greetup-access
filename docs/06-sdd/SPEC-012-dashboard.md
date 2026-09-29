# SPEC-012 — Dashboard (Produtor + WebSocket Real-time)

> ⚠️ **SPEC a reduzir** — polling em vez de WebSocket (D-17). Em qualquer conflito, vale o [MVP-REVISADO.md](./MVP-REVISADO.md). Não implemente a partir desta versão.

**Objetivo:** Implementar o dashboard completo do produtor com WebSocket para atualizações em tempo real, resumo de vendas, lista de participantes e painel financeiro com CQRS.

**Pré-requisitos:** SPEC-008, SPEC-010, SPEC-011

**Tempo estimado:** 2 dias

---

## 1. Estrutura de arquivos

```
apps/api/src/
├── dashboard/
│   ├── dashboard.module.ts
│   ├── dashboard.gateway.ts         ← WebSocket Gateway (Socket.io)
│   └── dashboard.service.ts
apps/web/
└── app/
    └── dashboard/
        ├── page.tsx                 ← dashboard home
        ├── events/
        │   └── [eventId]/
        │       ├── page.tsx         ← detalhe do evento
        │       ├── attendees/
        │       │   └── page.tsx     ← lista de participantes
        │       └── finance/
        │           └── page.tsx     ← painel financeiro
        └── withdrawals/
            └── page.tsx             ← histórico de retiradas
```

---

## 2. WebSocket Gateway

```typescript
// dashboard.gateway.ts
@WebSocketGateway({
  cors: { origin: process.env.NEXT_PUBLIC_APP_URL },
  namespace: "/dashboard",
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // Cliente se conecta e se junta às suas rooms
  handleConnection(client: Socket): void {
    // Valida token Privy do handshake
    // client.join(`tenant:${organizationId}:producer`)
    // client.join(`buyer:${userId}`) para compradores
  }

  handleDisconnect(client: Socket): void {
    client.rooms.forEach(room => client.leave(room));
  }

  // Emite para todos os produtores de uma org
  emitToProducer(organizationId: string, event: string, payload: unknown): void {
    this.server.to(`tenant:${organizationId}:producer`).emit(event, payload);
  }

  // Emite para um comprador específico
  emitToBuyer(buyerUserId: string, event: string, payload: unknown): void {
    this.server.to(`buyer:${buyerUserId}`).emit(event, payload);
  }
}

// Eventos emitidos via WebSocket:
// "sale.new"            → { ticketType, amountBrl, totalSold }
// "checkin.registered"  → { eventId, holderName, checkedInCount, totalSold }
// "balance.updated"     → { pending, available, withdrawn }
// "ticket.issued"       → { ticketId, qrCodeUrl } (para comprador)
// "withdrawal.status"   → { withdrawalId, status }
```

---

## 3. DashboardService

```typescript
@Injectable()
export class DashboardService {
  // KPIs da home do dashboard
  async getHomeKpis(organizationId: string): Promise<{
    grossRevenueBrl: number;
    ticketsSold: number;
    checkinCount: number;
    availableBalanceBrl: number;
    activeEvents: number;
  }>;

  // Resumo de vendas de um evento
  async getEventSummary(eventId: string, organizationId: string): Promise<{
    ticketsSold: number;
    capacityUsed: number;
    revenueByType: Array<{ typeName: string; count: number; revenueBrl: number }>;
    salesOverTime: Array<{ date: string; count: number }>;
    checkinRate: number;
  }>;

  // Lista de participantes com filtros
  async getAttendees(
    eventId: string,
    organizationId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      status?: TicketStatus;
      ticketTypeId?: string;
    },
  ): Promise<{ items: AttendeeView[]; total: number }>;

  // Exporta lista de participantes em CSV
  async exportAttendeesCsv(eventId: string, organizationId: string): Promise<string>;
}

export interface AttendeeView {
  ticketId: string;
  holderName: string | null;
  holderEmail: string;
  ticketTypeName: string;
  priceBrl: number;
  status: TicketStatus;
  purchasedAt: string;
  checkedInAt: string | null;
}
```

---

## 4. Endpoints

### GET /dashboard/kpis
```
Auth: produtor
Response 200: HomeKpis
Cache: Redis 60s
```

### GET /dashboard/events/:id/summary
```
Auth: produtor owner
Response 200: EventSummary
Cache: Redis 30s
```

### GET /dashboard/events/:id/attendees
```
Auth: produtor owner
Query: page=1, limit=50, search?, status?, ticketTypeId?
Response 200: { items: AttendeeView[], total: number }
```

### GET /dashboard/events/:id/attendees/export
```
Auth: produtor owner
Response 200: text/csv
Headers: Content-Disposition: attachment; filename="attendees-{eventId}.csv"
```

---

## 5. Configuração Next.js — WebSocket client

```typescript
// apps/web/lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/dashboard`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

// Hook React para usar WebSocket
export function useWebSocket(event: string, handler: (data: unknown) => void): void {
  const { getAccessToken } = usePrivy();
  useEffect(() => {
    let sock: Socket;
    getAccessToken().then(token => {
      sock = getSocket(token!);
      sock.on(event, handler);
    });
    return () => { sock?.off(event, handler); };
  }, [event]);
}
```

---

## 6. Testes esperados

### Unitários
- `DashboardService.getAttendees` filtra por status corretamente
- `DashboardService.exportAttendeesCsv` não inclui dados sensíveis além de email e nome
- `DashboardGateway.handleConnection` rejeita conexão sem token válido
- `DashboardGateway.emitToProducer` emite apenas para a room da organização correta

### Integração
- `GET /dashboard/kpis` retorna dados corretos após vendas
- `GET /dashboard/events/:id/attendees` respeita RLS (produtor não vê eventos de outra org)
- WebSocket emite "sale.new" após checkout confirmado

---

## 7. Definição de Pronto

- [ ] Dashboard home com KPIs funcionando
- [ ] Lista de participantes com busca e filtros
- [ ] Exportação CSV de participantes
- [ ] WebSocket emite eventos em tempo real ao produtor
- [ ] Contador de check-ins atualiza em tempo real
- [ ] Painel financeiro exibe saldo atualizado
- [ ] Todos os testes passam
