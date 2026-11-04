import {
  brasiliaToIso,
  isoToBrasilia,
  parseCalendarDate,
  parseClockTime,
  scheduleFromEvent,
  scheduleMessages,
  scheduleProblems,
  scheduleToIso,
} from "./event-schedule";

describe("brasiliaToIso", () => {
  it("sends the date and time of Brasília with the America/Sao_Paulo offset", () => {
    expect(brasiliaToIso("12/10/2026", "21:00")).toBe("2026-10-12T21:00:00-03:00");
    expect(brasiliaToIso("01/01/2027", "00:05")).toBe("2027-01-01T00:05:00-03:00");
    // The instant is the same one the API stores in UTC.
    expect(new Date(brasiliaToIso("12/10/2026", "21:00")!).toISOString()).toBe(
      "2026-10-13T00:00:00.000Z",
    );
  });

  it("uses the offset of that day, the old daylight saving time included", () => {
    expect(brasiliaToIso("01/12/2018", "21:00")).toBe("2018-12-01T21:00:00-02:00");
    expect(brasiliaToIso("01/07/2018", "21:00")).toBe("2018-07-01T21:00:00-03:00");
  });

  it("is null when the date or the time is not one", () => {
    expect(brasiliaToIso("31/02/2027", "21:00")).toBeNull();
    expect(brasiliaToIso("12/10/26", "21:00")).toBeNull();
    expect(brasiliaToIso("12/10/2026", "24:00")).toBeNull();
    expect(brasiliaToIso("12/10/2026", "21:60")).toBeNull();
    expect(brasiliaToIso("", "")).toBeNull();
  });
});

describe("isoToBrasilia and scheduleFromEvent", () => {
  it("show an instant in the fields of Brasília", () => {
    expect(isoToBrasilia("2026-10-13T00:00:00.000Z")).toEqual({
      date: "12/10/2026",
      time: "21:00",
    });
    expect(isoToBrasilia("2026-10-13T05:00:00.000Z")).toEqual({
      date: "13/10/2026",
      time: "02:00",
    });
  });

  it("leave the end empty when the event has none", () => {
    expect(scheduleFromEvent({ startsAt: "2026-10-13T00:00:00.000Z", endsAt: null })).toEqual({
      startDate: "12/10/2026",
      startTime: "21:00",
      endDate: "",
      endTime: "",
    });
    expect(
      scheduleFromEvent({
        startsAt: "2026-10-13T00:00:00.000Z",
        endsAt: "2026-10-13T05:00:00.000Z",
      }),
    ).toEqual({
      startDate: "12/10/2026",
      startTime: "21:00",
      endDate: "13/10/2026",
      endTime: "02:00",
    });
  });
});

describe("parseCalendarDate and parseClockTime", () => {
  it("take only days that exist and times of the clock", () => {
    expect(parseCalendarDate("29/02/2028")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseCalendarDate("29/02/2027")).toBeNull();
    expect(parseCalendarDate("00/10/2026")).toBeNull();
    expect(parseCalendarDate("12/13/2026")).toBeNull();
    expect(parseClockTime("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseClockTime("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseClockTime("9:30")).toBeNull();
  });
});

describe("scheduleProblems", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const valid = { startDate: "12/10/2026", startTime: "21:00", endDate: "", endTime: "" };

  it("takes a start in the future without an end", () => {
    expect(scheduleProblems(valid, now)).toEqual({});
    expect(scheduleToIso(valid)).toEqual({ startsAt: "2026-10-12T21:00:00-03:00", endsAt: null });
  });

  it("says under the date that a start already passed (595:14202)", () => {
    expect(scheduleProblems({ ...valid, startDate: "12/10/2025" }, now)).toEqual({
      startDate: scheduleMessages.past,
    });
    // One minute ago is the past too.
    expect(
      scheduleProblems({ ...valid, startDate: "01/10/2026", startTime: "08:59" }, now),
    ).toEqual({ startDate: scheduleMessages.past });
  });

  it("asks for the start's date and time in their formats", () => {
    expect(scheduleProblems({ ...valid, startDate: "", startTime: "25:00" }, now)).toEqual({
      startDate: scheduleMessages.date,
      startTime: scheduleMessages.time,
    });
  });

  it("takes an end with both fields, after the start", () => {
    const ended = { ...valid, endDate: "13/10/2026", endTime: "02:00" };
    expect(scheduleProblems(ended, now)).toEqual({});
    expect(scheduleToIso(ended)).toEqual({
      startsAt: "2026-10-12T21:00:00-03:00",
      endsAt: "2026-10-13T02:00:00-03:00",
    });

    expect(scheduleProblems({ ...valid, endDate: "13/10/2026" }, now)).toEqual({
      endTime: scheduleMessages.time,
    });
    expect(scheduleProblems({ ...valid, endTime: "02:00" }, now)).toEqual({
      endDate: scheduleMessages.date,
    });
    expect(scheduleToIso({ ...valid, endTime: "02:00" })).toBeNull();
  });

  it("says when the end is not after the start", () => {
    expect(scheduleProblems({ ...valid, endDate: "12/10/2026", endTime: "20:00" }, now)).toEqual({
      endDate: scheduleMessages.endBeforeStart,
    });
    expect(scheduleProblems({ ...valid, endDate: "12/10/2026", endTime: "21:00" }, now)).toEqual({
      endDate: scheduleMessages.endBeforeStart,
    });
  });
});
