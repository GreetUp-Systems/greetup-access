export type BirthDateResult = { ok: true; date: string } | { ok: false };

const pad = (value: number, length: number): string => String(value).padStart(length, "0");

/** YYYY-MM-DD, with a year of four digits even before 1000. */
function isoDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one; setUTCFullYear keeps years below 100.
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

/**
 * The birth date typed as DD/MM/AAAA (SPEC-015 R8) as YYYY-MM-DD: a date that exists, before
 * `today` (the browser's day). Anything else, an incomplete year included, is not a date.
 */
export function parseBirthDate(value: string, today: Date = new Date()): BirthDateResult {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (match === null) {
    return { ok: false };
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { ok: false };
  }
  const date = isoDate(year, month, day);
  const todayIso = isoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return date < todayIso ? { ok: true, date } : { ok: false };
}

/** DD/MM/AAAA from YYYY-MM-DD, to fill the field again from a previous attempt (SPEC-015 R2). */
export function formatBirthDate(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match === null ? null : `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * The API takes the birth date as an ISO 8601 date-time with an offset (SPEC-003 §8): the day at
 * midnight UTC. BlindPay gives the same day back in the previous attempt's data.
 */
export function birthDateForApi(date: string): string {
  return `${date}T00:00:00.000Z`;
}
