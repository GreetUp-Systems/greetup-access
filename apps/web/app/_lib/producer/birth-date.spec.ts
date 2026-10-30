import { birthDateForApi, formatBirthDate, parseBirthDate } from "./birth-date";

// The browser's day: local time, so the test reads the same in any time zone.
const today = new Date(2026, 9, 30, 12, 0, 0);

describe("parseBirthDate", () => {
  it("turns DD/MM/AAAA into YYYY-MM-DD", () => {
    expect(parseBirthDate("15/03/1990", today)).toEqual({ ok: true, date: "1990-03-15" });
    expect(parseBirthDate(" 01/01/2000 ", today)).toEqual({ ok: true, date: "2000-01-01" });
  });

  it("knows the length of each month and the leap years", () => {
    expect(parseBirthDate("29/02/2000", today)).toEqual({ ok: true, date: "2000-02-29" });
    expect(parseBirthDate("29/02/1996", today)).toEqual({ ok: true, date: "1996-02-29" });
    expect(parseBirthDate("29/02/1900", today)).toEqual({ ok: false });
    expect(parseBirthDate("29/02/1999", today)).toEqual({ ok: false });
    expect(parseBirthDate("31/04/1990", today)).toEqual({ ok: false });
    expect(parseBirthDate("31/12/1990", today)).toEqual({ ok: true, date: "1990-12-31" });
  });

  it("refuses a day or a month that does not exist", () => {
    expect(parseBirthDate("00/03/1990", today)).toEqual({ ok: false });
    expect(parseBirthDate("32/03/1990", today)).toEqual({ ok: false });
    expect(parseBirthDate("15/00/1990", today)).toEqual({ ok: false });
    expect(parseBirthDate("15/13/1990", today)).toEqual({ ok: false });
  });

  it("refuses an incomplete date (Seus dados · Erros: 15/03/19) or another format", () => {
    expect(parseBirthDate("15/03/19", today)).toEqual({ ok: false });
    expect(parseBirthDate("", today)).toEqual({ ok: false });
    expect(parseBirthDate("15031990", today)).toEqual({ ok: false });
    expect(parseBirthDate("1990-03-15", today)).toEqual({ ok: false });
    expect(parseBirthDate("15/3/1990", today)).toEqual({ ok: false });
  });

  it("only takes a day before today", () => {
    expect(parseBirthDate("29/10/2026", today)).toEqual({ ok: true, date: "2026-10-29" });
    expect(parseBirthDate("30/10/2026", today)).toEqual({ ok: false });
    expect(parseBirthDate("31/10/2026", today)).toEqual({ ok: false });
    expect(parseBirthDate("01/01/2030", today)).toEqual({ ok: false });
  });

  it("keeps years before 100 as they are, not as 19xx", () => {
    expect(parseBirthDate("01/01/0099", today)).toEqual({ ok: true, date: "0099-01-01" });
  });
});

describe("formatBirthDate", () => {
  it("fills the field again from the previous attempt's YYYY-MM-DD", () => {
    expect(formatBirthDate("1990-03-15")).toBe("15/03/1990");
  });

  it("gives nothing for a value out of shape", () => {
    expect(formatBirthDate("1990-3-15")).toBeNull();
    expect(formatBirthDate("15/03/1990")).toBeNull();
    expect(formatBirthDate("")).toBeNull();
  });
});

describe("birthDateForApi", () => {
  it("sends the day as an ISO 8601 date-time at midnight UTC, as the API asks", () => {
    expect(birthDateForApi("1990-03-15")).toBe("1990-03-15T00:00:00.000Z");
    expect(new Date(birthDateForApi("1990-03-15")).toISOString().slice(0, 10)).toBe("1990-03-15");
  });
});
