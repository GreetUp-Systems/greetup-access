import type { EventDetail } from "../api/producer-events";
import { parseSection, scheduleSummary, sectionSummary } from "./event-sections";

const event: EventDetail = {
  id: "e1",
  slug: "festival-de-inverno",
  name: "Festival de Inverno",
  description: "Uma noite de música ao vivo.",
  category: "festivals",
  coverUrl: "https://covers.test/e1.png",
  venueName: "Casa Fluida",
  city: { code: 3550308, name: "São Paulo", uf: "SP" },
  address: "Rua Augusta, 1200",
  startsAt: "2026-10-13T00:00:00.000Z",
  endsAt: "2026-10-13T05:00:00.000Z",
  capacity: 300,
  refundPolicy: "Reembolso integral até 7 dias antes do evento.",
  status: "draft",
  publishedAt: null,
  cancelledAt: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  ticketTypes: [
    { id: "t1", name: "Pista", description: null, priceCents: 12000, quantity: 120 },
    { id: "t2", name: "Camarote", description: null, priceCents: 24000, quantity: 30 },
  ],
  ticketMinPriceCents: 6000,
};

const summary = (
  section: Parameters<typeof sectionSummary>[0],
  fields: Partial<EventDetail> = {},
) => sectionSummary(section, { ...event, ...fields });

describe("sectionSummary", () => {
  it("says what each filled section has (Evento · Rascunho, 591:12579)", () => {
    expect(summary("nome")).toEqual({ text: "Festival de Inverno · Festivais", missing: false });
    expect(summary("data").text).toBe("Seg, 12 out · 21:00 às 02:00");
    expect(summary("capacidade").text).toBe("300 pessoas");
    expect(summary("local").text).toBe("Casa Fluida · São Paulo, SP");
    expect(summary("capa")).toEqual({ text: "Enviada", missing: false });
    expect(summary("ingressos").text).toBe("2 tipos · 150 de 300 lugares");
    expect(summary("descricao").text).toBe("Reembolso integral até 7 dias antes do evento.");
  });

  it("marks what the publication still needs (Publicar bloqueado, 595:13914)", () => {
    expect(summary("capa", { coverUrl: null })).toEqual({
      text: "Falta enviar · obrigatória para publicar",
      missing: true,
    });
    expect(summary("local", { city: null })).toEqual({
      text: "Falta escolher a cidade · obrigatória para publicar",
      missing: true,
    });
    expect(summary("nome", { category: null })).toEqual({
      text: "Falta escolher a categoria · obrigatória para publicar",
      missing: true,
    });
    expect(summary("ingressos", { ticketTypes: [] })).toEqual({
      text: "Falta adicionar um tipo · obrigatório para publicar",
      missing: true,
    });
  });

  it("says what is missing in an empty section the publication does not need", () => {
    expect(summary("descricao", { refundPolicy: null, description: null })).toEqual({
      text: "Falta escrever",
      missing: false,
    });
    expect(summary("descricao", { refundPolicy: null }).text).toBe("Uma noite de música ao vivo.");
    expect(summary("local", { venueName: null }).text).toBe("São Paulo, SP");
  });

  it("counts one of a kind in the singular", () => {
    expect(summary("capacidade", { capacity: 1 }).text).toBe("1 pessoa");
    expect(summary("ingressos", { ticketTypes: event.ticketTypes.slice(0, 1) }).text).toBe(
      "1 tipo · 120 de 300 lugares",
    );
  });
});

describe("scheduleSummary", () => {
  it("shows the start alone, or with the end's time up to the next day", () => {
    expect(scheduleSummary({ startsAt: event.startsAt, endsAt: null })).toBe("Seg, 12 out · 21:00");
    expect(scheduleSummary({ startsAt: event.startsAt, endsAt: "2026-10-13T02:00:00.000Z" })).toBe(
      "Seg, 12 out · 21:00 às 23:00",
    );
  });

  it("says the end's day when it is later", () => {
    expect(scheduleSummary({ startsAt: event.startsAt, endsAt: "2026-10-15T02:00:00.000Z" })).toBe(
      "Seg, 12 out · 21:00 às 14 out, 23:00",
    );
  });
});

describe("parseSection", () => {
  it("takes the sections of ?editar= and nothing else", () => {
    expect(parseSection("data")).toBe("data");
    expect(parseSection("ingressos")).toBe("ingressos");
    expect(parseSection("datas")).toBeNull();
    expect(parseSection(null)).toBeNull();
  });
});
