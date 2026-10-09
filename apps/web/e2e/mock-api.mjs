// A stand-in for the Access API in the end-to-end tests (SPEC-014 §11). The event page is rendered on
// the server, so the browser's request interception would not reach it: both the Next.js server and
// the browser call this process instead. Fixtures follow the Figma example event.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.MOCK_API_PORT ?? 3101);
const day = 24 * 60 * 60 * 1000;
// The test session's token (app/_lib/e2e-session.ts).
const token = "e2e-session-token";

const base = {
  name: "Festival de Inverno",
  description:
    "Uma noite de música ao vivo e DJs na Casa Fluida, com cozinha de inverno e pista aberta até as 2h. As portas abrem às 21h.",
  venueName: "Casa Fluida",
  address: "Rua Augusta, 1200 · São Paulo",
  refundPolicy: "Reembolso integral até 7 dias antes do evento.",
  producer: { displayName: "Casa Fluida" },
};

const startsAt = new Date(Date.now() + 30 * day).toISOString();

// Checkout scenarios, one per ticket type of "Festival de Cenários": what creating the order, and
// then generating its Pix, answers. Each test asks for its own event, "festival-de-cenarios-<id>",
// whose ticket types are "<id>~<scenario>", so tests running side by side never share a state.
const scenarioTypes = [
  { id: "feliz", name: "Pista", priceCents: 12000 },
  { id: "minimo", name: "Meia", priceCents: 6000, create: [422, "purchase_below_minimum"] },
  { id: "maximo", name: "Mesa", priceCents: 450000, create: [422, "purchase_above_maximum"] },
  { id: "esgota", name: "Lote 1", priceCents: 12000, create: [409, "ticket_type_sold_out"] },
  { id: "falha", name: "Lote 2", priceCents: 12000, create: [409, "producer_not_ready_for_sales"] },
  { id: "total-muda", name: "Lote 3", priceCents: 12000, pix: ["total_changed"] },
  { id: "conexao", name: "Lote 4", priceCents: 12000, pix: ["connection"] },
  { id: "expira", name: "Lote 5", priceCents: 12000, pix: ["expired"] },
  {
    id: "expira-esgota",
    name: "Lote 6",
    priceCents: 12000,
    pix: ["expired"],
    recreate: "sold_out",
  },
  { id: "nao-conclui", name: "Lote 7", priceCents: 12000, pix: ["rejected"] },
];
const soldOut = new Set();

function event(slug) {
  const now = Date.now();
  const upcoming = { startsAt, endsAt: null };
  switch (slug) {
    case "festival-de-inverno":
      return {
        ...base,
        ...upcoming,
        slug,
        status: "published",
        ticketTypes: [
          { id: "pista", name: "Pista", description: null, priceCents: 6000, available: 120 },
          { id: "camarote", name: "Camarote", description: null, priceCents: 12000, available: 2 },
          { id: "meia", name: "Meia-entrada", description: null, priceCents: 6000, available: 0 },
        ],
      };
    case "festival-cancelado":
      return { ...base, ...upcoming, slug, status: "cancelled", ticketTypes: [] };
    case "festival-comecou":
      return {
        ...base,
        slug,
        status: "published",
        startsAt: new Date(now - 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
        ticketTypes: [
          { id: "pista", name: "Pista", description: null, priceCents: 6000, available: 120 },
        ],
      };
    default:
      return slug.startsWith("festival-de-cenarios-")
        ? {
            ...base,
            ...upcoming,
            name: "Festival de Cenários",
            slug,
            status: "published",
            ticketTypes: scenarioTypes.map((type) => {
              const id = `${slug.slice("festival-de-cenarios-".length)}~${type.id}`;
              return {
                id,
                name: type.name,
                description: null,
                priceCents: type.priceCents,
                available: soldOut.has(id) ? 0 : 50,
              };
            }),
          }
        : null;
  }
}

// --- Purchases (SPEC-005 §9), for the test session's buyer only.
const purchases = new Map();
const byKey = new Map();

// The API's view: the record without the scenario's bookkeeping.
function view(record) {
  const purchase = { ...record };
  delete purchase.pixPlan;
  delete purchase.pixAttempts;
  return purchase;
}

function newPurchase(ticketTypeId, type, quantity) {
  // Only the first order of a type follows the scenario: the one the app creates again succeeds.
  const first = ![...purchases.values()].some((p) => p.ticketTypeId === ticketTypeId);
  const namespace = ticketTypeId.split("~")[0];
  const subtotalCents = type.priceCents * quantity;
  const serviceFeeCents = Math.round(subtotalCents / 10);
  const record = {
    id: randomUUID(),
    status: "initiated",
    eventId: namespace,
    ticketTypeId,
    event: {
      slug: `festival-de-cenarios-${namespace}`,
      name: "Festival de Cenários",
      startsAt,
      endsAt: null,
      venueName: base.venueName,
      address: base.address,
    },
    ticketType: { id: ticketTypeId, name: type.name },
    quantity,
    unitPriceCents: type.priceCents,
    subtotalCents,
    serviceFeeCents,
    totalCents: subtotalCents + serviceFeeCents,
    pixCode: null,
    createdAt: new Date().toISOString(),
    tickets: [],
    pixPlan: first ? (type.pix ?? []) : [],
    pixAttempts: 0,
  };
  purchases.set(record.id, record);
  return record;
}

function createPurchase(body, key) {
  const ticketTypeId = String(body.ticketTypeId ?? "");
  const type = scenarioTypes.find((candidate) => ticketTypeId.endsWith(`~${candidate.id}`));
  if (type === undefined) {
    return [404, { code: "ticket_type_not_available", message: "" }];
  }
  if (byKey.has(key)) {
    return [201, view(purchases.get(byKey.get(key)))];
  }
  const recreating = [...purchases.values()].some((p) => p.ticketTypeId === ticketTypeId);
  if (type.recreate === "sold_out" && recreating) {
    soldOut.add(ticketTypeId);
    return [409, { code: "ticket_type_sold_out", message: "" }];
  }
  if (type.create !== undefined) {
    if (type.create[1] === "ticket_type_sold_out") {
      soldOut.add(ticketTypeId);
    }
    return [type.create[0], { code: type.create[1], message: "" }];
  }
  const record = newPurchase(ticketTypeId, type, body.quantity);
  byKey.set(key, record.id);
  return [201, view(record)];
}

function createPix(record, body) {
  record.pixAttempts += 1;
  const outcome = record.pixPlan[record.pixAttempts - 1];
  if (outcome === "total_changed") {
    record.serviceFeeCents += 180;
    record.totalCents += 180;
    return [409, { code: "purchase_total_changed", message: "", purchase: view(record) }];
  }
  if (outcome === "connection") {
    return [503, { code: "payment_provider_unavailable", message: "" }];
  }
  if (outcome === "expired") {
    record.status = "payment_failed";
    return [409, { code: "purchase_expired", message: "" }];
  }
  if (outcome === "rejected") {
    record.status = "payment_failed";
    return [422, { code: "payment_rejected", message: "" }];
  }
  if (body.expectedTotalCents !== record.totalCents) {
    return [409, { code: "purchase_total_changed", message: "", purchase: view(record) }];
  }
  record.status = "awaiting_payment";
  record.pixCode = `00020126580014br.gov.bcb.pix0136${record.id}5204000053039865802BR6304ABCD`;
  return [200, view(record)];
}

// --- Following the order (SPEC-008 §7). The tests move it forward through the /__test routes
// below, as the BlindPay webhook and the MintTicketWorker would, and the streams open for it hear
// each stage change, closing on a final one, like the API.
const stages = {
  initiated: "order_placed",
  awaiting_payment: "awaiting_payment",
  payment_confirmed: "payment_confirmed",
  ticket_issued: "ticket_issued",
  payment_failed: "not_completed",
  payment_refunded: "not_completed",
};
const finalStages = new Set(["ticket_issued", "not_completed"]);
const streams = new Map();
let lastTokenId = 41;

function openStream(record, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const open = streams.get(record.id) ?? new Set();
  streams.set(record.id, open);
  open.add(response);
  response.on("close", () => open.delete(response));
  emitStage(record, response);
}

function emitStage(record, response) {
  const stage = stages[record.status];
  const data = { purchaseId: record.id, stage, status: record.status };
  response.write(`event: status\ndata: ${JSON.stringify(data)}\n\n`);
  if (finalStages.has(stage)) {
    response.end();
  }
}

function moved(record) {
  for (const response of streams.get(record.id) ?? []) {
    emitStage(record, response);
  }
}

const advance = {
  // The payin confirmed: the tickets wait for their mint.
  pay(record) {
    record.status = "payment_confirmed";
    record.tickets = Array.from({ length: record.quantity }, () => ({
      id: randomUUID(),
      status: "pending_mint",
      tokenId: null,
    }));
    moved(record);
  },
  // Every ticket minted.
  issue(record) {
    record.status = "ticket_issued";
    record.tickets = record.tickets.map((ticket) => {
      lastTokenId += 1;
      return { ...ticket, status: "issued", tokenId: lastTokenId };
    });
    moved(record);
  },
  fail(record) {
    record.status = "payment_failed";
    moved(record);
  },
  // The stream ran its 15 minutes: it says so and closes; the order stays as it is.
  timeout(record) {
    for (const response of streams.get(record.id) ?? []) {
      response.write(`event: timeout\ndata: ${JSON.stringify({ purchaseId: record.id })}\n\n`);
      response.end();
    }
  },
};

// The ticket view of SPEC-008 §5, with its QR token once issued.
function ticketView(record, ticket) {
  const minted = ticket.status === "issued";
  return {
    id: ticket.id,
    status: ticket.status,
    code: minted ? `AX-${String(ticket.tokenId).padStart(4, "0")}` : null,
    event: { id: record.eventId, status: "published", ...record.event },
    ticketType: record.ticketType,
    purchaseId: record.id,
    issuedAt: minted ? new Date().toISOString() : null,
    onchain: minted
      ? { contractId: "CTICKET", tokenId: ticket.tokenId, transactionHash: null, explorerUrl: null }
      : null,
    qrToken: minted ? `qr.${ticket.id}.e2e` : null,
  };
}

// --- The producer system (SPEC-015 §6). The test session names its scenario after the token,
// "e2e-session-token:<scenario>" (app/_lib/e2e-session.ts); fixtures follow the Figma screens.
const week = 7 * day;

// The Figma dates while they are ahead, then the same weekday and hour in a later week.
function ahead(iso) {
  let time = new Date(iso).getTime();
  while (time < Date.now() + day) {
    time += week;
  }
  return new Date(time).toISOString();
}

function weeksAgo(weeks, hourUtc) {
  const date = new Date(Date.now() - weeks * week);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

const cities = {
  saoPaulo: { code: 3550308, name: "São Paulo", uf: "SP" },
  curitiba: { code: 4106902, name: "Curitiba", uf: "PR" },
  rio: { code: 3304557, name: "Rio de Janeiro", uf: "RJ" },
  bh: { code: 3106200, name: "Belo Horizonte", uf: "MG" },
};

function producerEvent(fields) {
  const createdAt = new Date(Date.now() - 60 * day).toISOString();
  return {
    slug: fields.id,
    description: null,
    category: "festivals",
    coverUrl: null,
    address: null,
    endsAt: null,
    refundPolicy: null,
    status: "published",
    publishedAt: createdAt,
    cancelledAt: null,
    createdAt,
    updatedAt: createdAt,
    soldTickets: 0,
    salesCents: 0,
    ...fields,
  };
}

// À venda 2, Rascunhos 1 and Encerrados 4, as the tabs of Desktop · Eventos (307:2983).
function producerEvents() {
  return [
    producerEvent({
      id: "festival-de-inverno",
      name: "Festival de Inverno",
      venueName: "Casa Fluida",
      city: cities.saoPaulo,
      startsAt: ahead("2026-10-13T00:00:00.000Z"),
      capacity: 300,
      soldTickets: 120,
      salesCents: 2_640_000,
    }),
    producerEvent({
      id: "feira-criativa",
      name: "Feira Criativa",
      category: "food",
      venueName: "Parque da Cidade",
      city: cities.curitiba,
      startsAt: ahead("2026-11-14T13:00:00.000Z"),
      capacity: 150,
      soldTickets: 62,
      salesCents: 409_200,
    }),
    producerEvent({
      id: "noite-de-jazz",
      name: "Noite de Jazz",
      category: "shows",
      status: "draft",
      publishedAt: null,
      venueName: "Blue Note",
      city: cities.rio,
      startsAt: ahead("2026-11-05T23:00:00.000Z"),
      capacity: 200,
    }),
    producerEvent({
      id: "sunset-session",
      name: "Sunset Session",
      category: "parties",
      venueName: "Casa Fluida",
      city: cities.saoPaulo,
      startsAt: weeksAgo(2, 21),
      capacity: 250,
      soldTickets: 250,
      salesCents: 1_500_000,
    }),
    producerEvent({
      id: "baile-de-primavera",
      name: "Baile de Primavera",
      category: "parties",
      venueName: "Casa Fluida",
      city: cities.saoPaulo,
      startsAt: weeksAgo(5, 23),
      capacity: 300,
      soldTickets: 281,
      salesCents: 1_686_000,
    }),
    producerEvent({
      id: "mostra-de-curtas",
      name: "Mostra de Curtas",
      category: "theater",
      venueName: "Cine Belas Artes",
      city: cities.bh,
      startsAt: weeksAgo(9, 22),
      capacity: 120,
      soldTickets: 96,
      salesCents: 288_000,
    }),
    producerEvent({
      id: "feira-de-outono",
      name: "Feira de Outono",
      category: "food",
      status: "cancelled",
      cancelledAt: new Date(Date.now() - 20 * day).toISOString(),
      venueName: "Parque da Cidade",
      city: cities.curitiba,
      startsAt: ahead("2026-10-24T13:00:00.000Z"),
      capacity: 150,
    }),
  ];
}

const readyProducer = {
  id: "00000000-0000-4000-8000-0000000000aa",
  displayName: "Casa Fluida",
  onboardingStatus: "ready",
  compliance: { status: "approved", hasOpenRfi: false },
  stellar: { status: "active" },
};

// --- The Painel's sales (SPEC-015 §8), shaped as Desktop · Painel (284:1571): 182 tickets and
// R$ 21.840 in 30 days, 12% and 8% over the 30 days before, the best day four days ago.
const figmaBars = [
  35, 48, 29, 58, 45, 70, 83, 42, 54, 64, 50, 75, 93, 61, 46, 67, 88, 56, 74, 96, 66, 80, 59, 99,
  114, 160, 93, 80, 126, 102,
];
const brasiliaDate = (instant) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

function salesSummary(period, totals) {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[period];
  const bars = Array.from(
    { length: days },
    (_, index) => figmaBars[(index + 30 - (days % 30)) % 30],
  );
  const weight = bars.reduce((sum, bar) => sum + bar, 0);
  const scale = totals === null ? 0 : days / 30;
  const salesCents = totals === null ? 0 : Math.round((2_184_000 * scale) / 100) * 100;
  const tickets = totals === null ? 0 : Math.round(182 * scale);
  const daily = bars.map((bar, index) => ({
    date: brasiliaDate(new Date(Date.now() - (days - 1 - index) * day)),
    tickets: Math.round((tickets * bar) / weight),
    salesCents: Math.round((salesCents * bar) / weight / 100) * 100,
  }));
  return {
    period,
    tickets,
    salesCents,
    previous:
      totals === null
        ? { tickets: 0, salesCents: 0 }
        : { tickets: Math.round(tickets / 1.12), salesCents: Math.round(salesCents / 1.08) },
    daily,
  };
}

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const recentSales = () => [
  {
    eventName: "Festival de Inverno",
    ticketTypeName: "Pista",
    quantity: 2,
    subtotalCents: 26_400,
    confirmedAt: minutesAgo(5),
  },
  {
    eventName: "Festival de Inverno",
    ticketTypeName: "Camarote",
    quantity: 1,
    subtotalCents: 26_400,
    confirmedAt: minutesAgo(32),
  },
  {
    eventName: "Feira Criativa",
    ticketTypeName: "Geral",
    quantity: 3,
    subtotalCents: 19_800,
    confirmedAt: minutesAgo(60),
  },
];
const openRfi = {
  id: "rfi_e2e",
  status: "pending",
  request: [],
  expiresAt: "2026-11-03T15:00:00.000Z",
  createdAt: "2026-10-07T15:00:00.000Z",
};

const unavailable = [503, { code: "http_503", message: "" }];
const noProducer = [404, { code: "producer_not_found", message: "" }];
const producerWith = (fields) => [200, { ...readyProducer, ...fields }];
const drafts = () => producerEvents().filter((event) => event.status === "draft");
const pending = (status, hasOpenRfi = false) => ({
  onboardingStatus: "compliance_pending",
  compliance: { status, hasOpenRfi },
});
// Calls per session token, for the scenarios that change after the first answer.
const calls = new Map();

// Each scenario answers GET /producers/me and GET /events: [status, body]. A test that needs its
// own counters adds "~<id>" to the scenario's name.
const producerScenarios = {
  ready: {
    me: () => [200, readyProducer],
    events: () => [200, producerEvents()],
    sales: true,
  },
  "first-event": { me: () => [200, readyProducer], events: () => [200, []] },
  "approved-rfi": {
    me: () =>
      producerWith({
        onboardingStatus: "ready",
        compliance: { status: "approved_rfi", hasOpenRfi: true },
      }),
    events: () => [200, producerEvents()],
    sales: true,
    rfi: true,
  },
  setup: { me: () => producerWith(pending(null)), events: () => [200, drafts()] },
  verifying: { me: () => producerWith(pending("verifying")), events: () => [200, drafts()] },
  rfi: {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, producerEvents()],
    sales: true,
    rfi: true,
  },
  rejected: { me: () => producerWith(pending("rejected")), events: () => [200, drafts()] },
  releasing: {
    me: () =>
      producerWith({
        onboardingStatus: "wallet_registration_pending",
        compliance: { status: "approved", hasOpenRfi: false },
      }),
    events: () => [200, drafts()],
  },
  "no-producer": { me: () => noProducer, events: () => noProducer },
  failure: { me: () => unavailable, events: () => unavailable },
  // The first load fails; "Tentar de novo" works.
  "failure-once": {
    me: (count) => (count === 1 ? unavailable : [200, readyProducer]),
    events: () => [200, producerEvents()],
  },
};

function producerScenario(authorization) {
  const prefix = `Bearer ${token}:`;
  if (!authorization?.startsWith(prefix)) {
    return undefined;
  }
  const session = authorization.slice(prefix.length);
  const scenario = producerScenarios[session.split("~")[0]];
  return scenario === undefined ? undefined : { ...scenario, session };
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      try {
        resolve(raw === "" ? null : JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key",
  );
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  const url = request.url ?? "";

  const publicEvent = /^\/api\/public\/events\/([^/?]+)/.exec(url);
  if (publicEvent !== null) {
    const found = event(decodeURIComponent(publicEvent[1]));
    if (found === null) {
      send(response, 404, { code: "event_not_found", message: "Not found." });
    } else {
      send(response, 200, found);
    }
    return;
  }

  const control = /^\/__test\/purchases\/([^/?]+)\/(pay|issue|fail|timeout)$/.exec(url);
  if (control !== null && request.method === "POST") {
    const record = purchases.get(control[1]);
    if (record === undefined) {
      send(response, 404, { code: "purchase_not_found", message: "" });
      return;
    }
    // A timeout needs a stream to end: until the page opens one, the test asks again.
    if (control[2] === "timeout" && (streams.get(record.id)?.size ?? 0) === 0) {
      send(response, 409, { code: "no_open_stream", message: "" });
      return;
    }
    advance[control[2]](record);
    send(response, 200, view(record));
    return;
  }

  const [path, query = ""] = url.split("?");
  if (
    path === "/api/producers/me/sales" ||
    path === "/api/producers/me/sales/recent" ||
    path === "/api/producers/onboarding/rfi"
  ) {
    const scenario = producerScenario(request.headers.authorization);
    if (scenario === undefined) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const params = new URLSearchParams(query);
    if (path === "/api/producers/onboarding/rfi") {
      send(response, 200, scenario.rfi === true ? openRfi : null);
    } else if (path === "/api/producers/me/sales/recent") {
      const limit = Number(params.get("limit") ?? 5);
      send(response, 200, scenario.sales === true ? recentSales().slice(0, limit) : []);
    } else {
      const period = params.get("period") ?? "";
      if (!["7d", "30d", "90d"].includes(period)) {
        send(response, 400, { code: "invalid_sales_query", message: "" });
        return;
      }
      send(response, 200, salesSummary(period, scenario.sales === true ? {} : null));
    }
    return;
  }

  if (url === "/api/producers/me" || url === "/api/events") {
    const scenario = producerScenario(request.headers.authorization);
    if (scenario === undefined) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const key = `${scenario.session} ${url}`;
    const count = (calls.get(key) ?? 0) + 1;
    calls.set(key, count);
    const [status, body] = url === "/api/events" ? scenario.events(count) : scenario.me(count);
    send(response, status, body);
    return;
  }

  if (url.startsWith("/api/me/tickets/")) {
    if (request.headers.authorization !== `Bearer ${token}`) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const id = decodeURIComponent(url.slice("/api/me/tickets/".length));
    for (const record of purchases.values()) {
      const ticket = record.tickets.find((candidate) => candidate.id === id);
      if (ticket !== undefined) {
        send(response, 200, ticketView(record, ticket));
        return;
      }
    }
    send(response, 404, { code: "ticket_not_found", message: "" });
    return;
  }

  if (url.startsWith("/api/purchases")) {
    if (request.headers.authorization !== `Bearer ${token}`) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const body = await readBody(request);
    if (request.method === "POST" && url === "/api/purchases") {
      const [status, payload] = createPurchase(body ?? {}, request.headers["idempotency-key"]);
      send(response, status, payload);
      return;
    }
    const match = /^\/api\/purchases\/([^/?]+)(\/pix|\/stream)?$/.exec(url);
    const record = match === null ? undefined : purchases.get(match[1]);
    if (record === undefined) {
      send(response, 404, { code: "purchase_not_found", message: "" });
      return;
    }
    if (request.method === "POST" && match[2] === "/pix") {
      const [status, payload] = createPix(record, body ?? {});
      send(response, status, payload);
      return;
    }
    if (request.method === "GET" && match[2] === "/stream") {
      openStream(record, response);
      return;
    }
    send(response, 200, view(record));
    return;
  }

  send(response, 404, { code: "not_found", message: "Not found." });
}).listen(port);
