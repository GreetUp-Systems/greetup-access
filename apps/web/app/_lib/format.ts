// Values in reais and dates in pt-BR, in the America/Sao_Paulo time zone (SPEC-014 §7).
const timeZone = "America/Sao_Paulo";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 4000 → "R$ 40,00" (with the regular space Intl uses replaced, so it never wraps). */
export function formatPrice(cents: number): string {
  return currency.format(cents / 100).replace(/\s/u, " ");
}

interface DateParts {
  weekday: string;
  day: string;
  month: string;
  hour: string;
  minute: string;
  dateKey: string;
}

const partsFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(iso: string): DateParts {
  const values = Object.fromEntries(
    partsFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    weekday: values.weekday ?? "",
    day: values.day ?? "",
    month: values.month ?? "",
    hour: String(Number(values.hour ?? "0")),
    minute: values.minute ?? "00",
    dateKey: `${values.year}-${values.month}-${values.day}`,
  };
}

/** "21h", or "21h30" when there are minutes. */
function time(p: DateParts): string {
  return p.minute === "00" ? `${p.hour}h` : `${p.hour}h${p.minute}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Sáb, 12 de outubro, 21h": the event start as the event page shows it. */
export function formatEventStart(startsAt: string): string {
  const p = parts(startsAt);
  return `${capitalize(p.weekday.slice(0, 3))}, ${p.day} de ${p.month}, ${time(p)}`;
}

/**
 * The end under the start: "Até as 23h" on the same day, "Até as 2h de domingo" on the next day,
 * "Até 14 de outubro, 2h" later; null without an end.
 */
export function formatEventEnd(startsAt: string, endsAt: string | null): string | null {
  if (endsAt === null) {
    return null;
  }
  const start = parts(startsAt);
  const end = parts(endsAt);
  if (end.dateKey === start.dateKey) {
    return `Até as ${time(end)}`;
  }
  const nextDay = parts(new Date(new Date(startsAt).getTime() + 24 * 60 * 60 * 1000).toISOString());
  if (end.dateKey === nextDay.dateKey) {
    return `Até as ${time(end)} de ${end.weekday.replace("-feira", "")}`;
  }
  return `Até ${end.day} de ${end.month}, ${time(end)}`;
}

/** "120 disponíveis", "1 disponível" or "Esgotado" under a ticket type. */
export function formatAvailability(available: number): string {
  if (available <= 0) {
    return "Esgotado";
  }
  return available === 1 ? "1 disponível" : `${available} disponíveis`;
}
