import type { TicketType } from "../api/producer-events";
import {
  createTicketTypeInput,
  fitsInCapacity,
  seatsInTypes,
  seatsLine,
  ticketCount,
  ticketTypeChanges,
  ticketTypeForm,
  ticketTypeHelp,
  ticketTypeProblems,
} from "./ticket-types";

const pista: TicketType = {
  id: "pista",
  name: "Pista",
  description: "Acesso à pista e ao bar.",
  priceCents: 12000,
  quantity: 120,
};
const camarote: TicketType = {
  id: "camarote",
  name: "Camarote",
  description: null,
  priceCents: 24000,
  quantity: 30,
};

describe("what fits in the capacity", () => {
  it("counts the seats of the types (150 de 300 lugares nos tipos)", () => {
    expect(seatsInTypes([pista, camarote])).toBe(150);
    expect(seatsInTypes([])).toBe(0);
    expect(seatsLine([pista, camarote], 300)).toBe("150 de 300 lugares nos tipos");
  });

  it("is the capacity minus the other types, never below zero", () => {
    // A new type: 300 - 150.
    expect(fitsInCapacity(300, [pista, camarote], null)).toBe(150);
    // Editing Camarote, its own 30 are not counted (Passa da capacidade: use até 180).
    expect(fitsInCapacity(300, [pista, camarote], "camarote")).toBe(180);
    // The types already take more than the capacity.
    expect(fitsInCapacity(100, [pista, camarote], null)).toBe(0);
    expect(fitsInCapacity(100, [], null)).toBe(100);
  });
});

describe("ticketTypeProblems", () => {
  const rules = { minimumCents: 6000, fits: 150 };
  const form = { name: "Meia-entrada", description: "", price: "R$ 60,00", quantity: "50" };

  it("takes a type with a name, a price from the minimum and what fits", () => {
    expect(ticketTypeProblems(form, rules)).toEqual({});
    expect(ticketTypeProblems({ ...form, quantity: "150" }, rules)).toEqual({});
  });

  it("asks for the name and a price from the minimum (594:13557)", () => {
    expect(ticketTypeProblems({ ...form, name: " ", price: "R$ 40,00" }, rules)).toEqual({
      name: "Escreva o nome do tipo.",
      price: "O mínimo é R$ 60,00.",
    });
    expect(ticketTypeProblems({ ...form, price: "" }, rules)).toEqual({
      price: "O mínimo é R$ 60,00.",
    });
    expect(ticketTypeProblems({ ...form, price: "59,99" }, rules)).toEqual({
      price: "O mínimo é R$ 60,00.",
    });
  });

  it("refuses a quantity above what fits, saying how many fit (594:13181)", () => {
    expect(ticketTypeProblems({ ...form, quantity: "151" }, rules)).toEqual({
      quantity: "Passa da capacidade: use até 150.",
    });
    expect(ticketTypeProblems({ ...form, quantity: "" }, rules)).toEqual({
      quantity: "Preencha este campo.",
    });
  });

  it("shows the minimum and what fits under the fields", () => {
    expect(ticketTypeHelp.price(6000)).toBe("Mínimo de R$ 60,00.");
    expect(ticketTypeHelp.quantity(150)).toBe("Até 150 pela capacidade.");
  });
});

describe("what Adicionar and Salvar send", () => {
  it("creates the type in cents, without an empty description", () => {
    expect(
      createTicketTypeInput({
        name: " Pista ",
        description: " ",
        price: "R$ 120,00",
        quantity: "120",
      }),
    ).toEqual({ name: "Pista", priceCents: 12000, quantity: 120 });
    expect(
      createTicketTypeInput({
        name: "Meia",
        description: "Estudantes",
        price: "60",
        quantity: "50",
      }),
    ).toEqual({ name: "Meia", description: "Estudantes", priceCents: 6000, quantity: 50 });
  });

  it("changes only what changed, clearing an emptied description", () => {
    const form = ticketTypeForm(pista);
    expect(form).toEqual({
      name: "Pista",
      description: "Acesso à pista e ao bar.",
      price: "R$ 120,00",
      quantity: "120",
    });
    expect(ticketTypeChanges(pista, form)).toEqual({});
    expect(ticketTypeChanges(pista, { ...form, quantity: "100", description: "" })).toEqual({
      description: null,
      quantity: 100,
    });
    expect(ticketTypeChanges(camarote, { ...ticketTypeForm(camarote), price: "250" })).toEqual({
      priceCents: 25000,
    });
  });

  it("counts the tickets of a type on the phone's list", () => {
    expect(ticketCount(120)).toBe("120 ingressos");
    expect(ticketCount(1)).toBe("1 ingresso");
  });
});
