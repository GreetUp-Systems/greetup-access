import type { EventDetail } from "../api/producer-events";
import {
  capacityProblem,
  cityLabel,
  createEventInput,
  draftChanges,
  draftFromEvent,
  draftPassoProblems,
  draftPassosDone,
  emptyDraft,
  eventMessages,
  locationChanges,
  locationFromEvent,
  minimumCapacity,
  textsChanges,
} from "./event-form";

const now = new Date("2026-10-01T12:00:00.000Z");

const filled = {
  ...emptyDraft,
  name: " Festival de Inverno ",
  category: "festivals" as const,
  startDate: "12/10/2026",
  startTime: "21:00",
  capacity: "300",
};

const draftEvent: EventDetail = {
  id: "e1",
  slug: "festival-de-inverno",
  name: "Festival de Inverno",
  description: null,
  category: "festivals",
  coverUrl: null,
  venueName: null,
  city: null,
  address: null,
  startsAt: "2026-10-13T00:00:00.000Z",
  endsAt: null,
  capacity: 300,
  refundPolicy: null,
  status: "draft",
  publishedAt: null,
  cancelledAt: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  ticketTypes: [{ id: "t1", name: "Pista", description: null, priceCents: 12000, quantity: 120 }],
  ticketMinPriceCents: 6000,
};

describe("the draft's passos", () => {
  it("asks for the name and the category (Nome e categoria)", () => {
    expect(draftPassoProblems(emptyDraft, 1, now)).toEqual({
      name: "Escreva o nome do evento.",
      category: "Escolha uma categoria.",
    });
    expect(draftPassoProblems(filled, 1, now)).toEqual({});
  });

  it("checks the date and time of the start (Data e horário)", () => {
    expect(draftPassoProblems({ ...filled, startDate: "12/10/2025" }, 2, now)).toEqual({
      startDate: "Já passou. Use uma data futura.",
    });
  });

  it("asks for a whole capacity from 1", () => {
    expect(capacityProblem("")).toBe(eventMessages.capacity);
    expect(capacityProblem("0")).toBe(eventMessages.capacity);
    expect(capacityProblem("1")).toBeNull();
    // A published event: not below the seats of its types.
    expect(capacityProblem("100", 150)).toBe("Os tipos já somam 150 lugares. Use 150 ou mais.");
    expect(capacityProblem("150", 150)).toBeNull();
  });

  it("counts the passos done in a row", () => {
    expect(draftPassosDone(emptyDraft, now)).toBe(0);
    expect(draftPassosDone({ ...emptyDraft, name: "Festa", category: "parties" }, now)).toBe(1);
    expect(draftPassosDone({ ...filled, capacity: "" }, now)).toBe(2);
    expect(draftPassosDone(filled, now)).toBe(3);
    // A later passo does not count while an earlier one is wrong.
    expect(draftPassosDone({ ...filled, name: "" }, now)).toBe(0);
  });
});

describe("createEventInput", () => {
  it("sends the draft with the start in Brasília and no empty end", () => {
    expect(createEventInput(filled, now)).toEqual({
      name: "Festival de Inverno",
      category: "festivals",
      startsAt: "2026-10-12T21:00:00-03:00",
      capacity: 300,
    });
    expect(
      createEventInput({ ...filled, endDate: "13/10/2026", endTime: "02:00" }, now),
    ).toMatchObject({ endsAt: "2026-10-13T02:00:00-03:00" });
  });

  it("is null while a passo is wrong", () => {
    expect(createEventInput({ ...filled, capacity: "" }, now)).toBeNull();
  });
});

describe("draftChanges", () => {
  const saved = draftFromEvent(draftEvent);

  it("fills the passos back from the event", () => {
    expect(saved).toEqual({
      name: "Festival de Inverno",
      category: "festivals",
      startDate: "12/10/2026",
      startTime: "21:00",
      endDate: "",
      endTime: "",
      capacity: "300",
    });
  });

  it("sends nothing when nothing changed", () => {
    expect(draftChanges(draftEvent, saved)).toEqual({});
  });

  it("sends only what changed, the end cleared or set", () => {
    expect(draftChanges(draftEvent, { ...saved, capacity: "350", name: "Festival" })).toEqual({
      name: "Festival",
      capacity: 350,
    });
    expect(draftChanges(draftEvent, { ...saved, endDate: "13/10/2026", endTime: "02:00" })).toEqual(
      {
        endsAt: "2026-10-13T02:00:00-03:00",
      },
    );
    expect(
      draftChanges({ ...draftEvent, endsAt: "2026-10-13T05:00:00.000Z" }, { ...saved }),
    ).toEqual({ endsAt: null });
    expect(draftChanges(draftEvent, { ...saved, startTime: "22:00" })).toEqual({
      startsAt: "2026-10-12T22:00:00-03:00",
    });
  });

  it("knows the minimum capacity of a published event", () => {
    expect(minimumCapacity(draftEvent)).toBe(0);
    expect(minimumCapacity({ ...draftEvent, status: "published" })).toBe(120);
  });
});

describe("the details' changes", () => {
  it("sends the place, the city by its code and the address; empty clears", () => {
    const campinas = { code: 3509502, name: "Campinas", uf: "SP" };
    expect(
      locationChanges(draftEvent, { venueName: " Casa Fluida ", city: campinas, address: "" }),
    ).toEqual({ venueName: "Casa Fluida", cityCode: 3509502 });

    const located = {
      ...draftEvent,
      venueName: "Casa Fluida",
      city: campinas,
      address: "Rua A, 1",
    };
    expect(locationChanges(located, locationFromEvent(located))).toEqual({});
    expect(
      locationChanges(located, { ...locationFromEvent(located), venueName: "", address: "" }),
    ).toEqual({ venueName: null, address: null });
    // Without a city chosen the city stays as it is: it is replaced, never cleared.
    expect(locationChanges(located, { ...locationFromEvent(located), city: null })).toEqual({});
    expect(cityLabel(campinas)).toBe("Campinas, SP");
  });

  it("sends the description and the refund policy that changed", () => {
    expect(
      textsChanges(draftEvent, { description: "Uma noite de música.", refundPolicy: " " }),
    ).toEqual({ description: "Uma noite de música." });
    expect(
      textsChanges(
        { ...draftEvent, refundPolicy: "Reembolso integral." },
        { description: "", refundPolicy: "" },
      ),
    ).toEqual({ refundPolicy: null });
  });
});
