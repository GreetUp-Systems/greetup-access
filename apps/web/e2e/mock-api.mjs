// A stand-in for the Access API in the end-to-end tests (SPEC-014 §11). The event page is rendered on
// the server, so the browser's request interception would not reach it: both the Next.js server and
// the browser call this process instead. Fixtures follow the Figma example event.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.MOCK_API_PORT ?? 3101);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
  coverUrl: null,
};

// The example event has a cover: the shared link's image (SPEC-016 S13).
const exampleCoverUrl = "https://covers.example.com/events/festival-de-inverno.jpg";

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
        coverUrl: exampleCoverUrl,
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
    event: {
      id: record.eventId,
      status: "published",
      coverUrl: null,
      city: cities.saoPaulo,
      ...record.event,
    },
    ticketType: record.ticketType,
    purchaseId: record.id,
    issuedAt: minted ? new Date().toISOString() : null,
    onchain: minted
      ? { contractId: "CTICKET", tokenId: ticket.tokenId, transactionHash: null, explorerUrl: null }
      : null,
    qrToken: minted ? `qr.${ticket.id}.e2e` : null,
  };
}

// --- Meus ingressos (SPEC-014 9D). A buyer scenario rides on the token, like the producer's:
// "e2e-session-token:buyer:<scenario>" (app/_lib/e2e-session.ts). The events follow the Figma
// screens, at days from today; the covers come from this process, so the cards load offline.
const coverColors = {
  inverno: ["#3b0f3a", "#c63fa0"],
  jazz: ["#0f1b3d", "#e8c26a"],
  feira: ["#fdf3e1", "#ff7a3d"],
  makers: ["#c9f0df", "#ff6b57"],
};

function coverSvg(name) {
  const [background, accent] = coverColors[name] ?? ["#2a1028", "#c63fa0"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="${background}"/><circle cx="980" cy="300" r="260" fill="${accent}"/></svg>`;
}

const coverUrl = (name) => `http://localhost:${port}/covers/${name}.svg`;

const buyerCities = {
  saoPaulo: { code: 3550308, name: "São Paulo", uf: "SP" },
  rio: { code: 3304557, name: "Rio de Janeiro", uf: "RJ" },
  curitiba: { code: 4106902, name: "Curitiba", uf: "PR" },
  recife: { code: 2611606, name: "Recife", uf: "PE" },
  salvador: { code: 2927408, name: "Salvador", uf: "BA" },
  bh: { code: 3106200, name: "Belo Horizonte", uf: "MG" },
  campinas: { code: 3509502, name: "Campinas", uf: "SP" },
};

// [key, name, days from today, venue, address, city, has a cover, status, its tickets' types]
const buyerEvents = [
  [
    "inverno",
    "Festival de Inverno",
    6,
    "Casa Fluida",
    "Rua Augusta, 1200",
    "saoPaulo",
    true,
    "published",
    ["Pista", "Pista"],
  ],
  [
    "jazz",
    "Noite de Jazz",
    30,
    "Blue Note",
    "Av. Atlântica, 1910",
    "rio",
    true,
    "published",
    ["Pista"],
  ],
  [
    "feira",
    "Feira Criativa",
    39,
    "Parque da Cidade",
    "Rua Eng. Ostoja Roguski, 690",
    "curitiba",
    true,
    "published",
    ["Geral"],
  ],
  [
    "makers",
    "Encontro de Makers",
    104,
    "Porto Digital",
    "Rua do Apolo, 181",
    "recife",
    true,
    "published",
    ["Geral"],
  ],
  [
    "verao",
    "Show de Verão",
    -40,
    "Concha Acústica",
    "Ladeira da Fonte, s/n",
    "salvador",
    false,
    "published",
    ["Pista"],
  ],
  [
    "foto",
    "Workshop de Foto",
    -10,
    "Estúdio Luz",
    "Rua Sergipe, 1440",
    "bh",
    false,
    "cancelled",
    ["Pista", "Pista"],
  ],
  [
    "junina",
    "Festa Junina",
    -110,
    "Arraial do Largo",
    "Largo do Rosário, 1",
    "campinas",
    false,
    "published",
    ["Pista"],
  ],
  [
    "poesia",
    "Noite de Poesia",
    -150,
    "Livraria Aurora",
    "Rua Fradique Coutinho, 900",
    "saoPaulo",
    false,
    "published",
    ["Pista"],
  ],
];

// Ticket ids are UUID v4, like the API's; another person's ticket answers 404.
const buyerTicketId = (event, index) =>
  `9d000000-0000-4000-8000-${String(event * 10 + index + 1).padStart(12, "0")}`;

function buyerTickets(scenario, reads) {
  const today = Date.now();
  const tickets = [];
  buyerEvents.forEach(([key, name, days, venueName, address, city, cover, status, types], e) => {
    const startsAt = new Date(today + days * day);
    startsAt.setUTCMinutes(0, 0, 0);
    if (scenario === "past" && days >= 0 && status !== "cancelled") {
      return;
    }
    const event = {
      id: `9d000000-0000-4000-9000-${String(e + 1).padStart(12, "0")}`,
      slug: key,
      name,
      status,
      startsAt: startsAt.toISOString(),
      endsAt: null,
      venueName,
      address,
      coverUrl: cover ? coverUrl(key) : null,
      city: buyerCities[city],
    };
    types.forEach((typeName, index) => {
      // "issuing": the first event's second ticket is still being issued until its third read.
      const issuing = scenario === "issuing" && e === 0 && index === 1 && reads < 3;
      const tokenId = 42 + e * 10 + index;
      tickets.push({
        id: buyerTicketId(e, index),
        status: issuing ? "pending_mint" : "issued",
        code: issuing ? null : `AX-${String(tokenId).padStart(4, "0")}`,
        event,
        ticketType: { id: `${key}-${typeName.toLowerCase()}`, name: typeName },
        purchaseId: `9d000000-0000-4000-a000-${String(e + 1).padStart(12, "0")}`,
        issuedAt: issuing ? null : new Date(today - (30 - index) * day).toISOString(),
        onchain: issuing
          ? null
          : { contractId: "CTICKET", tokenId, transactionHash: null, explorerUrl: null },
        // The API signs the token of any issued ticket, cancelled event or not (SPEC-014 M3).
        qrToken: issuing ? null : `qr.${buyerTicketId(e, index)}.e2e`,
      });
    });
  });
  return tickets;
}

function withoutQr(ticket) {
  const listed = { ...ticket };
  delete listed.qrToken;
  return listed;
}

// "<scenario>~<test>": what follows "~" keeps the reads of tests running side by side apart.
function buyerScenario(authorization) {
  const prefix = `Bearer ${token}:buyer:`;
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length).split("~")[0]
    : undefined;
}

function ticketFound(ticket) {
  return ticket === undefined ? [404, { code: "ticket_not_found", message: "" }] : [200, ticket];
}

// GET /api/me/tickets and /api/me/tickets/:id.
function myTickets(authorization, ticketId) {
  const scenario = buyerScenario(authorization);
  const key = `${authorization} ${ticketId ?? "list"}`;
  const reads = (calls.get(key) ?? 0) + 1;
  calls.set(key, reads);
  if (scenario === undefined) {
    // The checkout's buyer: the tickets of the orders paid in this run.
    const tickets = [...purchases.values()].flatMap((record) =>
      record.tickets.map((ticket) => ticketView(record, ticket)),
    );
    return ticketId === undefined
      ? [200, { tickets: tickets.map(withoutQr) }]
      : ticketFound(tickets.find((ticket) => ticket.id === ticketId));
  }
  if (scenario === "expired") {
    return [401, { code: "invalid_auth_token", message: "" }];
  }
  if (ticketId === undefined) {
    if (scenario === "failure-once" && reads === 1) {
      return unavailable;
    }
    const tickets = scenario === "empty" ? [] : buyerTickets(scenario, 0);
    return [200, { tickets: tickets.map(withoutQr) }];
  }
  return ticketFound(buyerTickets(scenario, reads).find((ticket) => ticket.id === ticketId));
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
// BlindPay's request for information of the Figma screens (Pendência · Pergunta 1 to 3 de 3):
// a list and a file, a text, and a text with a format.
const rfiSections = [
  {
    title: "Proof of address",
    description:
      "The proof of address attached doesn't match the address provided. Please upload a new one.",
    fields: [
      {
        key: "proof_of_address_doc_type",
        label: "Proof of address type",
        required: true,
        items: [
          { label: "Utility bill", value: "UTILITY_BILL" },
          { label: "Bank statement", value: "BANK_STATEMENT" },
          { label: "Rental agreement", value: "RENTAL_AGREEMENT" },
        ],
      },
      {
        key: "proof_of_address_doc_file",
        label: "Proof of address file",
        required: true,
        regex: "^https://[^\\s]+$",
      },
    ],
  },
  {
    title: "Source of funds",
    description: "Please describe where the money you will receive from ticket sales comes from.",
    fields: [
      { key: "source_of_funds_description", label: "Source of funds description", required: true },
    ],
  },
  {
    title: "Website",
    description:
      "Please share the link to the page where you sell or promote your events. It must start with https://",
    fields: [{ key: "website", label: "Website", required: true, regex: "^https://" }],
  },
];
const openRfi = {
  id: "rfi_e2e",
  status: "pending",
  request: rfiSections,
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

// --- Criar perfil and the Recebimento (SPEC-015 15C). What each session did in this run: the
// profile created, the receiving account's activation, the verification sent and its keys.
const onboarding = new Map();
const activationHash = "e2".repeat(32);

function onboardingOf(session) {
  let state = onboarding.get(session);
  if (state === undefined) {
    state = {
      displayName: null,
      stellar: "not_started",
      kyc: undefined,
      createCalls: 0,
      customerKeys: [],
    };
    onboarding.set(session, state);
  }
  return state;
}

// The producer created in this run by Criar perfil, at the start of the Recebimento.
function createdProducer(state) {
  return {
    ...readyProducer,
    displayName: state.displayName,
    onboardingStatus: state.stellar === "active" ? "compliance_pending" : "stellar_pending",
    compliance: { status: state.kyc ?? null, hasOpenRfi: false },
    stellar: { status: state.stellar },
  };
}

// The refused attempt's data, for the new one (SPEC-015 §8, R2), with the reason of the Figma
// screen (Recebimento · Recusado).
const blurryReason = {
  code: "DOC_BLURRY",
  message: "The document image is blurry. Please upload a clearer photo of the front of the ID.",
};
const rejectedAttempt = {
  status: "rejected",
  reasons: [blurryReason],
  draft: {
    firstName: "Ana",
    lastName: "Souza",
    dateOfBirth: "1990-03-15",
    taxId: "12345678909",
    phoneNumber: "+5511912345678",
    addressLine1: "Rua Augusta, 1200",
    addressLine2: "Apto 42",
    city: "São Paulo",
    stateProvinceRegion: "SP",
    postalCode: "01310100",
    country: "BR",
    idDocCountry: "BR",
    idDocType: "ID_CARD",
  },
};

// Recusado · Vários motivos and Sem motivo (501:5276, 520:11765).
const severalReasonsAttempt = {
  ...rejectedAttempt,
  reasons: [
    blurryReason,
    { code: "FACE_MISMATCH", message: "The selfie does not match the photo on the document." },
  ],
};
const noReasonAttempt = { ...rejectedAttempt, reasons: [] };

const isUuid = (value) => typeof value === "string" && uuidV4.test(value);

// POST /api/producers: creates the profile of a session without one ("new-producer"); the
// "...-failure" scenario fails the first time.
function createProfile(scenario, body) {
  const state = onboardingOf(scenario.session);
  if (!scenario.newProducer) {
    return [409, { code: "producer_already_exists", message: "" }];
  }
  state.createCalls += 1;
  if (scenario.createFails && state.createCalls === 1) {
    return unavailable;
  }
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  if (displayName === "" || displayName.length > 120) {
    return [400, { code: "invalid_producer_profile", message: "" }];
  }
  state.displayName = displayName;
  return [201, createdProducer(state)];
}

const signing = [200, { status: "signing", hashToSign: activationHash }];
const accountActive = [200, { status: "active", transactionHash: activationHash }];
const staleSignature = [409, { code: "activation_signature_stale", message: "" }];

// The receiving account of an existing producer whose scenario follows a plan (SPEC-015 R3, R6):
// "failed" waits for "Tentar de novo" to prepare and sign it again; "flaky" answers 503 three times
// before it can be prepared; "submitted" stays confirming on the network; "wallet" fails the
// registration of BlindPay's wallet once.
function plannedActivation(plan, state, signature) {
  if (plan === "submitted") {
    return [200, { status: "submitted", transactionHash: activationHash }];
  }
  if (plan === "wallet") {
    state.walletCalls = (state.walletCalls ?? 0) + 1;
    if (state.walletCalls === 1) {
      return [502, { code: "blindpay_wallet_registration_failed", message: "" }];
    }
    state.walletRegistered = true;
    return accountActive;
  }
  if (signature === undefined) {
    state.planCalls = (state.planCalls ?? 0) + 1;
    return plan === "flaky" && state.planCalls <= 3 ? unavailable : signing;
  }
  if (signature?.hash !== activationHash) {
    return staleSignature;
  }
  state.accountReady = true;
  return accountActive;
}

// The receiving account: signed in the browser, then active. Existing producers are active.
function activate(scenario, signature) {
  const state = onboardingOf(scenario.session);
  if (scenario.account !== undefined && !state.accountReady) {
    return plannedActivation(scenario.account, state, signature);
  }
  if (!scenario.newProducer || state.stellar === "active") {
    state.stellar = "active";
    return [200, { status: "active", transactionHash: activationHash }];
  }
  if (signature === undefined) {
    state.stellar = "signing";
    return [200, { status: "signing", hashToSign: activationHash }];
  }
  if (signature?.hash !== activationHash) {
    return [409, { code: "activation_signature_stale", message: "" }];
  }
  state.stellar = "active";
  return [200, { status: "active", transactionHash: activationHash }];
}

// POST .../files: one file to BlindPay. The test chooses the outcome by the file's name.
function uploadFile(raw, key) {
  if (!isUuid(key)) {
    return [400, { code: "invalid_idempotency_key", message: "" }];
  }
  const name = /filename="([^"]*)"/.exec(raw)?.[1] ?? "";
  if (name.includes("recusado")) {
    return [422, { code: "document_upload_failed", message: "" }];
  }
  if (name.includes("falha")) {
    return [503, { code: "compliance_provider_unavailable", message: "" }];
  }
  return [200, { fileUrl: `https://files.blindpay.e2e/${randomUUID()}` }];
}

// POST .../customer: "Enviar para verificação". The scenario chooses the outcome; "...-failure"
// fails once and takes the repeat only with the same Idempotency-Key.
function createCustomer(scenario, body, key) {
  const state = onboardingOf(scenario.session);
  if (!isUuid(key)) {
    return [400, { code: "invalid_idempotency_key", message: "" }];
  }
  if (body?.type !== "individual" || body?.kycType !== "standard" || !body?.tosId) {
    return [400, { code: "invalid_onboarding_input", message: "" }];
  }
  state.customerKeys.push(key);
  if (scenario.submit === "busy") {
    return [409, { code: "customer_attempt_already_active", message: "" }];
  }
  if (scenario.submit === "refused") {
    return [422, { code: "customer_creation_failed", message: "" }];
  }
  if (scenario.submit === "failure") {
    if (state.customerKeys.length === 1) {
      return [503, { code: "compliance_provider_unavailable", message: "" }];
    }
    if (key !== state.customerKeys[0]) {
      return [422, { code: "customer_attempt_failed", message: "" }];
    }
  }
  state.kyc = "verifying";
  return [201, { id: randomUUID(), customerId: "re_e2e", type: "individual", status: "verifying" }];
}

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
  // The Recebimento's submission answered 409, 422, or 503 once (SPEC-015 §6).
  "setup-busy": {
    me: () => producerWith(pending(null)),
    events: () => [200, drafts()],
    submit: "busy",
  },
  "setup-refused": {
    me: () => producerWith(pending(null)),
    events: () => [200, drafts()],
    submit: "refused",
  },
  "setup-failure": {
    me: () => producerWith(pending(null)),
    events: () => [200, drafts()],
    submit: "failure",
  },
  // BlindPay's terms could not be opened the first time.
  "setup-terms-failure": {
    me: () => producerWith(pending(null)),
    events: () => [200, drafts()],
    tosFails: true,
  },
  // No profile until Criar perfil creates it; "-failure" fails the first creation.
  "new-producer": {
    me: (count, session) => {
      const state = onboardingOf(session);
      return state.displayName === null ? noProducer : [200, createdProducer(state)];
    },
    events: () => [200, []],
    newProducer: true,
  },
  "new-producer-failure": {
    me: (count, session) => {
      const state = onboardingOf(session);
      return state.displayName === null ? noProducer : [200, createdProducer(state)];
    },
    events: () => [200, []],
    newProducer: true,
    createFails: true,
  },
  verifying: { me: () => producerWith(pending("verifying")), events: () => [200, drafts()] },
  rfi: {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, producerEvents()],
    sales: true,
    rfi: true,
  },
  rejected: {
    me: () => producerWith(pending("rejected")),
    events: () => [200, drafts()],
    attempt: rejectedAttempt,
  },
  // The refused attempt could not be read again: the new one starts empty.
  "rejected-draft-failure": {
    me: () => producerWith(pending("rejected")),
    events: () => [200, drafts()],
    attempt: "unavailable",
  },
  releasing: {
    me: () =>
      producerWith({
        onboardingStatus: "wallet_registration_pending",
        compliance: { status: "approved", hasOpenRfi: false },
      }),
    events: () => [200, drafts()],
  },
  // --- The results of the Recebimento (SPEC-015 15C, §6).
  // Refused with two reasons, with none, and with the reasons failing to load once.
  "rejected-reasons": {
    me: () => producerWith(pending("rejected")),
    events: () => [200, drafts()],
    attempt: severalReasonsAttempt,
  },
  "rejected-no-reason": {
    me: () => producerWith(pending("rejected")),
    events: () => [200, drafts()],
    attempt: noReasonAttempt,
  },
  "rejected-reason-failure-once": {
    me: () => producerWith(pending("rejected")),
    events: () => [200, drafts()],
    attempt: "unavailable-once",
  },
  // The configuration with the receiving account failed (Conta com erro, R3), and in analysis;
  // both until "Tentar de novo" signs it again.
  "setup-account-failed": {
    me: (count, session) => {
      const ready = onboardingOf(session).accountReady === true;
      return producerWith({
        ...pending(null),
        onboardingStatus: ready ? "compliance_pending" : "stellar_pending",
        stellar: { status: ready ? "active" : "failed" },
      });
    },
    events: () => [200, drafts()],
    account: "failed",
  },
  "verifying-account-failed": {
    me: (count, session) => {
      const ready = onboardingOf(session).accountReady === true;
      return producerWith({
        ...pending("verifying"),
        onboardingStatus: ready ? "compliance_pending" : "stellar_pending",
        stellar: { status: ready ? "active" : "failed" },
      });
    },
    events: () => [200, drafts()],
    account: "failed",
  },
  // In analysis, the account's preparation fails three times in a row (R6), then works.
  "account-stopped": {
    me: (count, session) => {
      const ready = onboardingOf(session).accountReady === true;
      return producerWith({
        ...pending("verifying"),
        onboardingStatus: ready ? "compliance_pending" : "stellar_pending",
        stellar: { status: ready ? "active" : "pending" },
      });
    },
    events: () => [200, drafts()],
    account: "flaky",
  },
  // Approved, the receiving account still confirming on the network.
  "account-on-way": {
    me: () =>
      producerWith({
        onboardingStatus: "stellar_pending",
        compliance: { status: "approved", hasOpenRfi: false },
        stellar: { status: "submitted" },
      }),
    events: () => [200, drafts()],
    account: "submitted",
  },
  // Approved, BlindPay's wallet refused once (Liberando · Falha), then ready.
  "releasing-failure": {
    me: (count, session) =>
      onboardingOf(session).walletRegistered
        ? [200, readyProducer]
        : producerWith({
            onboardingStatus: "wallet_registration_pending",
            compliance: { status: "approved", hasOpenRfi: false },
          }),
    events: () => [200, drafts()],
    account: "wallet",
  },
  // The request for information: failing to load once; answered and past its deadline; the
  // answer failing once, refused for a field once, or arriving after the request closed.
  "rfi-load-failure": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiLoad: "failure-once",
  },
  "rfi-submitted": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiStatus: "submitted",
  },
  "rfi-expired": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiStatus: "expired",
  },
  "rfi-submit-failure": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiSubmit: "failure",
  },
  "rfi-field-error": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiSubmit: "field-error",
  },
  "rfi-gone": {
    me: () => producerWith(pending("compliance_request", true)),
    events: () => [200, drafts()],
    rfi: true,
    rfiSubmit: "gone",
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

function readRaw(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.setEncoding("latin1");
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => resolve(raw));
  });
}

async function readBody(request) {
  const raw = await readRaw(request);
  try {
    return raw === "" ? null : JSON.parse(Buffer.from(raw, "latin1").toString("utf8"));
  } catch {
    return null;
  }
}

// GET .../rfi: the open request, as BlindPay keeps it. Answered, BlindPay no longer finds it (the
// API answers null); closed for an answer that came late, it is past its deadline.
function readRfi(scenario) {
  const state = onboardingOf(scenario.session);
  state.rfiReads = (state.rfiReads ?? 0) + 1;
  if (scenario.rfiLoad === "failure-once" && state.rfiReads === 1) {
    return unavailable;
  }
  if (scenario.rfi !== true || state.rfiAnswered) {
    return [200, null];
  }
  if (state.rfiGone) {
    return [200, { ...openRfi, status: "expired" }];
  }
  return [200, { ...openRfi, status: scenario.rfiStatus ?? "pending" }];
}

// The API's checks of an answer (SPEC-003 §8): only the request's keys, the required ones, a
// value of the list, the formats. The key at fault, "" when it is the body, null when it is fine.
function rfiProblem(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "";
  }
  const fields = rfiSections.flatMap((section) => section.fields);
  if (Object.keys(body).some((key) => !fields.some((field) => field.key === key))) {
    return "";
  }
  for (const field of fields) {
    const value = body[field.key];
    if (value === undefined) {
      if (field.required) {
        return field.key;
      }
      continue;
    }
    if (
      typeof value !== "string" ||
      value === "" ||
      (field.items !== undefined && !field.items.some((item) => item.value === value)) ||
      (field.regex !== undefined && !new RegExp(field.regex).test(value))
    ) {
      return field.key;
    }
  }
  return null;
}

// POST .../rfi: the single answer. The scenario chooses the outcome: "failure" fails once and takes
// the repeat only with the same Idempotency-Key; "field-error" refuses a field once; "gone" finds
// the request closed.
function answerRfi(scenario, body, key) {
  const state = onboardingOf(scenario.session);
  if (!isUuid(key)) {
    return [400, { code: "invalid_idempotency_key", message: "" }];
  }
  const open = scenario.rfi === true && (scenario.rfiStatus ?? "pending") === "pending";
  if (!open || state.rfiAnswered || state.rfiGone || scenario.rfiSubmit === "gone") {
    state.rfiGone = scenario.rfiSubmit === "gone" || state.rfiGone;
    return [404, { code: "rfi_not_found", message: "" }];
  }
  const problem = rfiProblem(body);
  if (problem !== null) {
    return [
      400,
      { code: "invalid_rfi_response", message: "", ...(problem === "" ? {} : { field: problem }) },
    ];
  }
  state.rfiKeys = [...(state.rfiKeys ?? []), key];
  if (scenario.rfiSubmit === "failure") {
    if (state.rfiKeys.length === 1) {
      return unavailable;
    }
    if (key !== state.rfiKeys[0]) {
      return [422, { code: "rfi_submission_failed", message: "" }];
    }
  }
  if (scenario.rfiSubmit === "field-error" && state.rfiKeys.length === 1) {
    return [
      400,
      { code: "invalid_rfi_response", message: "", field: "source_of_funds_description" },
    ];
  }
  state.rfiAnswered = true;
  return [201, null];
}

// The onboarding's routes (SPEC-003 §8) for a producer scenario; false when the URL is another.
async function onboardingRoute(request, response, path) {
  const routes = [
    "/api/producers",
    "/api/producers/onboarding/tos",
    "/api/producers/onboarding/files",
    "/api/producers/onboarding/customer",
    "/api/producers/onboarding/stellar/activate",
    "/api/producers/onboarding/stellar/activate/signature",
  ];
  if (!routes.includes(path) || (path === "/api/producers" && request.method !== "POST")) {
    return false;
  }
  const scenario = producerScenario(request.headers.authorization);
  if (scenario === undefined) {
    send(response, 401, { code: "invalid_auth_token", message: "" });
    return true;
  }
  const key = request.headers["idempotency-key"];
  if (path === "/api/producers/onboarding/files") {
    send(response, ...uploadFile(await readRaw(request), key));
    return true;
  }
  const body = await readBody(request);
  if (path === "/api/producers") {
    send(response, ...createProfile(scenario, body));
  } else if (path === "/api/producers/onboarding/tos") {
    const state = onboardingOf(scenario.session);
    state.tosCalls = (state.tosCalls ?? 0) + 1;
    if (scenario.tosFails && state.tosCalls === 1) {
      send(response, 503, { code: "compliance_provider_unavailable", message: "" });
    } else {
      // BlindPay's page, which the test answers; it comes back to `redirectUrl`.
      const redirect = encodeURIComponent(String(body?.redirectUrl ?? ""));
      send(response, 200, { url: `https://blindpay.e2e/terms?redirect=${redirect}` });
    }
  } else if (path === "/api/producers/onboarding/customer") {
    if (request.method === "GET") {
      if (scenario.attempt === undefined) {
        send(response, 404, { code: "blindpay_customer_not_found", message: "" });
      } else if (scenario.attempt === "unavailable") {
        send(response, 503, { code: "compliance_provider_unavailable", message: "" });
      } else if (scenario.attempt === "unavailable-once") {
        const state = onboardingOf(scenario.session);
        state.attemptReads = (state.attemptReads ?? 0) + 1;
        if (state.attemptReads === 1) {
          send(response, 503, { code: "compliance_provider_unavailable", message: "" });
        } else {
          send(response, 200, rejectedAttempt);
        }
      } else {
        send(response, 200, scenario.attempt);
      }
    } else {
      send(response, ...createCustomer(scenario, body, key));
    }
  } else if (path === "/api/producers/onboarding/stellar/activate") {
    send(response, ...activate(scenario, undefined));
  } else {
    send(response, ...activate(scenario, body ?? null));
  }
  return true;
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
  if (path === "/api/producers/me/sales" || path === "/api/producers/me/sales/recent") {
    const scenario = producerScenario(request.headers.authorization);
    if (scenario === undefined) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const params = new URLSearchParams(query);
    if (path === "/api/producers/me/sales/recent") {
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

  if (
    url === "/api/producers/me" &&
    (request.headers.authorization === `Bearer ${token}` ||
      buyerScenario(request.headers.authorization) !== undefined)
  ) {
    // The test buyer has an account and no producer profile, as the API answers (SPEC-016 §6).
    send(response, ...noProducer);
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
    const [status, body] =
      url === "/api/events"
        ? scenario.events(count, scenario.session)
        : scenario.me(count, scenario.session);
    // A verification sent in this run is in analysis.
    const sent = onboarding.get(scenario.session)?.kyc;
    send(
      response,
      status,
      url === "/api/producers/me" && status === 200 && sent !== undefined
        ? { ...body, compliance: { status: sent, hasOpenRfi: false } }
        : body,
    );
    return;
  }

  if (url === "/api/producers/onboarding/rfi") {
    const scenario = producerScenario(request.headers.authorization);
    if (scenario === undefined) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
    } else if (request.method === "POST") {
      const body = await readBody(request);
      send(response, ...answerRfi(scenario, body, request.headers["idempotency-key"]));
    } else {
      send(response, ...readRfi(scenario));
    }
    return;
  }

  if (await onboardingRoute(request, response, url.split("?")[0])) {
    return;
  }

  const cover = /^\/covers\/([a-z]+)\.svg$/.exec(url);
  if (cover !== null) {
    response.writeHead(200, { "Content-Type": "image/svg+xml" });
    response.end(coverSvg(cover[1]));
    return;
  }

  const myTicket = /^\/api\/me\/tickets(?:\/([^/?]+))?$/.exec(url);
  if (myTicket !== null) {
    const authorization = request.headers.authorization;
    if (authorization !== `Bearer ${token}` && buyerScenario(authorization) === undefined) {
      send(response, 401, { code: "invalid_auth_token", message: "" });
      return;
    }
    const id = myTicket[1] === undefined ? undefined : decodeURIComponent(myTicket[1]);
    // The API checks the id is a UUID v4 before reading it (ParseUUIDPipe): Nest's 400, no code.
    if (id !== undefined && !uuidV4.test(id)) {
      send(response, 400, {
        message: "Validation failed (uuid v4 is expected)",
        error: "Bad Request",
        statusCode: 400,
      });
      return;
    }
    send(response, ...myTickets(authorization, id));
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
