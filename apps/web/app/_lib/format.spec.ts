import { formatAvailability, formatEventEnd, formatEventStart, formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats cents as reais", () => {
    expect(formatPrice(4_000)).toBe("R$ 40,00");
    expect(formatPrice(123_456)).toBe("R$ 1.234,56");
    expect(formatPrice(5)).toBe("R$ 0,05");
  });
});

describe("formatEventStart", () => {
  it("shows the short weekday, day, month and hour in Brasília time", () => {
    // 00:00 UTC on 11/10 is 21:00 of Saturday 10/10 in São Paulo (UTC−3).
    expect(formatEventStart("2026-10-11T00:00:00.000Z")).toBe("Sáb, 10 de outubro, 21h");
  });

  it("keeps the minutes when there are any", () => {
    expect(formatEventStart("2026-10-12T22:30:00.000Z")).toBe("Seg, 12 de outubro, 19h30");
  });
});

describe("formatEventEnd", () => {
  const start = "2026-10-11T00:00:00.000Z"; // Sat 10/10, 21h in São Paulo

  it("is null without an end", () => {
    expect(formatEventEnd(start, null)).toBeNull();
  });

  it("shows only the hour on the same day", () => {
    expect(formatEventEnd(start, "2026-10-11T02:00:00.000Z")).toBe("Até as 23h");
  });

  it("names the next day by its weekday", () => {
    expect(formatEventEnd(start, "2026-10-11T05:00:00.000Z")).toBe("Até as 2h de domingo");
  });

  it("drops -feira from weekdays", () => {
    // Thu 15/10, 21h → Fri 16/10, 2h.
    expect(formatEventEnd("2026-10-16T00:00:00.000Z", "2026-10-16T05:00:00.000Z")).toBe(
      "Até as 2h de sexta",
    );
  });

  it("shows the date when the end is later than the next day", () => {
    expect(formatEventEnd(start, "2026-10-13T05:00:00.000Z")).toBe("Até 13 de outubro, 2h");
  });
});

describe("formatAvailability", () => {
  it("counts the tickets left and says Esgotado at zero", () => {
    expect(formatAvailability(120)).toBe("120 disponíveis");
    expect(formatAvailability(1)).toBe("1 disponível");
    expect(formatAvailability(0)).toBe("Esgotado");
  });
});
