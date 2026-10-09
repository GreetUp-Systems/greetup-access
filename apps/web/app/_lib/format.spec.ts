import {
  brasiliaDay,
  formatAmount,
  formatAvailability,
  formatDayMonth,
  formatDaysUntil,
  formatEventEnd,
  formatEventStart,
  formatPrice,
  formatReais,
  formatShortDayMonth,
  formatTicketDateTime,
  formatTimeAgo,
  formatWeekdayDate,
} from "./format";

describe("formatPrice", () => {
  it("formats cents as reais", () => {
    expect(formatPrice(4_000)).toBe("R$ 40,00");
    expect(formatPrice(123_456)).toBe("R$ 1.234,56");
    expect(formatPrice(5)).toBe("R$ 0,05");
  });
});

describe("formatAmount", () => {
  it("formats cents as reais without the currency", () => {
    expect(formatAmount(2_640_000)).toBe("26.400,00");
    expect(formatAmount(409_200)).toBe("4.092,00");
    expect(formatAmount(0)).toBe("0,00");
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

describe("formatTicketDateTime", () => {
  it("shows the short weekday and month and the 24-hour time in Brasília time", () => {
    expect(formatTicketDateTime("2026-10-13T00:00:00.000Z")).toBe("Seg, 12 out · 21:00");
    expect(formatTicketDateTime("2026-10-12T12:05:00.000Z")).toBe("Seg, 12 out · 09:05");
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

describe("Painel formats", () => {
  it("writes today and days in Brasília", () => {
    // 15:00 UTC is noon in São Paulo.
    expect(formatWeekdayDate("2026-10-05T15:00:00.000Z")).toBe("Segunda, 5 de outubro");
    expect(formatWeekdayDate("2026-10-10T15:00:00.000Z")).toBe("Sábado, 10 de outubro");
    expect(formatDayMonth("2026-11-03T15:00:00.000Z")).toBe("3 de novembro");
    expect(formatShortDayMonth(brasiliaDay("2026-10-02"))).toBe("2 out");
  });

  it("rounds sales to whole reais", () => {
    expect(formatReais(2_184_000)).toBe("21.840");
    expect(formatReais(2_183_960)).toBe("21.840");
    expect(formatReais(0)).toBe("0");
  });

  it("says how long ago a sale happened", () => {
    const now = new Date("2026-10-06T15:00:00Z");
    const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
    expect(formatTimeAgo(ago(0), now)).toBe("agora");
    expect(formatTimeAgo(ago(5), now)).toBe("há 5 min");
    expect(formatTimeAgo(ago(60), now)).toBe("há 1 h");
    expect(formatTimeAgo(ago(60 * 24), now)).toBe("há 1 dia");
    expect(formatTimeAgo(ago(60 * 24 * 3), now)).toBe("há 3 dias");
  });

  it("counts calendar days until an event in Brasília", () => {
    // 23:30 in São Paulo on 6/10.
    const now = new Date("2026-10-07T02:30:00Z");
    expect(formatDaysUntil("2026-10-07T00:00:00Z", now)).toBe("Hoje");
    // 21:00 on 7/10 in São Paulo: tomorrow there, though the same UTC day.
    expect(formatDaysUntil("2026-10-08T00:00:00Z", now)).toBe("Amanhã");
    expect(formatDaysUntil("2026-10-13T00:00:00Z", now)).toBe("Em 6 dias");
  });
});
