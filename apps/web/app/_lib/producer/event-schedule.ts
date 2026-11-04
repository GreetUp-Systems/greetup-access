// The date and time of an event as the producer types them (SPEC-015 §6): DD/MM/AAAA and HH:MM in
// Brasília, sent to the API in ISO 8601 with the America/Sao_Paulo offset. The API works in UTC;
// showing Brasília is the web's job (SPEC-004 §8).

export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";

/** Data e horário as typed: the start is required, the end optional with both of its fields. */
export interface ScheduleFields {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export type ScheduleField = keyof ScheduleFields;

export const emptySchedule: ScheduleFields = {
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
};

/** The messages of Data e horário (SPEC-015 §6; Figma 595:14202 and 595:14275). */
export const scheduleMessages = {
  date: "Data inválida. Use DD/MM/AAAA.",
  time: "Horário inválido. Use HH:MM.",
  past: "Já passou. Use uma data futura.",
  endBeforeStart: "O término precisa ser depois do início.",
} as const;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface ClockTime {
  hour: number;
  minute: number;
}

const pad = (value: number, length = 2): string => String(value).padStart(length, "0");

function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

/** DD/MM/AAAA of a day that exists; anything else (an incomplete year included) is not a date. */
export function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

/** HH:MM from 00:00 to 23:59. */
export function parseClockTime(value: string): ClockTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BRASILIA_TIME_ZONE,
  timeZoneName: "longOffset",
});

/** São Paulo's offset from UTC at an instant, in minutes (-180 since 2019). */
function offsetMinutesAt(instant: number): number {
  const name =
    offsetFormat.formatToParts(new Date(instant)).find((part) => part.type === "timeZoneName")
      ?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (match === null) {
    return 0;
  }
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? "0");
  return match[1] === "-" ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * "12/10/2026" and "21:00" in Brasília as "2026-10-12T21:00:00-03:00", or null when either is not
 * valid. The offset is the zone's on that day, so a date of the old daylight saving time gets its own.
 */
export function brasiliaToIso(date: string, time: string): string | null {
  const day = parseCalendarDate(date);
  const clock = parseClockTime(time);
  if (day === null || clock === null) {
    return null;
  }
  // The wall time read as UTC, moved by the zone's offset; a second look settles a change of offset.
  const wall = Date.UTC(day.year, day.month - 1, day.day, clock.hour, clock.minute);
  const first = offsetMinutesAt(wall - offsetMinutesAt(wall) * 60_000);
  const offset = offsetMinutesAt(wall - first * 60_000);
  return (
    `${pad(day.year, 4)}-${pad(day.month)}-${pad(day.day)}` +
    `T${pad(clock.hour)}:${pad(clock.minute)}:00${formatOffset(offset)}`
  );
}

const fieldsFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRASILIA_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An instant as the fields show it in Brasília: "12/10/2026" and "21:00". */
export function isoToBrasilia(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    fieldsFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** The fields of an event's start and end, to edit them (and to go back to the creation). */
export function scheduleFromEvent(event: { startsAt: string; endsAt: string | null }) {
  const start = isoToBrasilia(event.startsAt);
  const end = event.endsAt === null ? null : isoToBrasilia(event.endsAt);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end?.date ?? "",
    endTime: end?.time ?? "",
  } satisfies ScheduleFields;
}

/** The start and the end in ISO, once every field filled is right; the end is null when empty. */
export function scheduleToIso(
  fields: ScheduleFields,
): { startsAt: string; endsAt: string | null } | null {
  const startsAt = brasiliaToIso(fields.startDate, fields.startTime);
  if (startsAt === null) {
    return null;
  }
  if (fields.endDate.trim() === "" && fields.endTime.trim() === "") {
    return { startsAt, endsAt: null };
  }
  const endsAt = brasiliaToIso(fields.endDate, fields.endTime);
  return endsAt === null ? null : { startsAt, endsAt };
}

/**
 * What is wrong with Data e horário, field by field, in the order of the screen: each date and
 * time in its format; the start in the future; an end, when started, with both fields and after the
 * start (SPEC-015 §6). The past and the order are said under the date.
 */
export function scheduleProblems(
  fields: ScheduleFields,
  now: Date = new Date(),
): Partial<Record<ScheduleField, string>> {
  const problems: Partial<Record<ScheduleField, string>> = {};
  const startsAt = brasiliaToIso(fields.startDate, fields.startTime);
  if (parseCalendarDate(fields.startDate) === null) {
    problems.startDate = scheduleMessages.date;
  }
  if (parseClockTime(fields.startTime) === null) {
    problems.startTime = scheduleMessages.time;
  }
  if (startsAt !== null && Date.parse(startsAt) <= now.getTime()) {
    problems.startDate = scheduleMessages.past;
  }
  const hasEnd = fields.endDate.trim() !== "" || fields.endTime.trim() !== "";
  if (!hasEnd) {
    return problems;
  }
  if (parseCalendarDate(fields.endDate) === null) {
    problems.endDate = scheduleMessages.date;
  }
  if (parseClockTime(fields.endTime) === null) {
    problems.endTime = scheduleMessages.time;
  }
  const endsAt = brasiliaToIso(fields.endDate, fields.endTime);
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    problems.endDate = scheduleMessages.endBeforeStart;
  }
  return problems;
}
