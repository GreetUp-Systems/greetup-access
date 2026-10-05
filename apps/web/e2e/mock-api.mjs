// A stand-in for the Access API in the end-to-end tests (SPEC-014 §11). The event page is rendered on
// the server, so the browser's request interception would not reach it: both the Next.js server and
// the browser call this process instead. Fixtures follow the Figma example event.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_API_PORT ?? 3101);
const day = 24 * 60 * 60 * 1000;

const base = {
  name: "Festival de Inverno",
  description:
    "Uma noite de música ao vivo e DJs na Casa Fluida, com cozinha de inverno e pista aberta até as 2h. As portas abrem às 21h.",
  venueName: "Casa Fluida",
  address: "Rua Augusta, 1200 · São Paulo",
  refundPolicy: "Reembolso integral até 7 dias antes do evento.",
  producer: { displayName: "Casa Fluida" },
};

function event(slug) {
  const now = Date.now();
  const upcoming = { startsAt: new Date(now + 30 * day).toISOString(), endsAt: null };
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
      return null;
  }
}

createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  const match = /^\/api\/public\/events\/([^/?]+)/.exec(request.url ?? "");
  const found = match === null ? null : event(decodeURIComponent(match[1]));
  if (found === null) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ code: "event_not_found", message: "Not found." }));
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(found));
}).listen(port);
