// Values in reais and dates in pt-BR, in the America/Sao_Paulo time zone (SPEC-014 §7).
const timeZone = "America/Sao_Paulo";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 4000 → "R$ 40,00" (with the regular space Intl uses replaced, so it never wraps). */
export function formatPrice(cents: number): string {
  return currency.format(cents / 100).replace(/\s/u, " ");
}

const amount = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 2640000 → "26.400,00": a value whose "R$" is drawn apart, as the revenue of the event tables. */
export function formatAmount(cents: number): string {
  return amount.format(cents / 100);
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

/** "Segunda, 6 de outubro": today, under the Painel's greeting. */
export function formatWeekdayDate(iso: string): string {
  const p = parts(iso);
  return `${capitalize(p.weekday.replace("-feira", ""))}, ${p.day} de ${p.month}`;
}

/** "3 de novembro". */
export function formatDayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} de ${p.month}`;
}

/** "3 nov": a day in a tight place (a step, a chart). */
export function formatShortDayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${p.month.slice(0, 3)}`;
}

/** A calendar day of Brasília (YYYY-MM-DD, as the sales API counts them) as an instant on it. */
export function brasiliaDay(date: string): string {
  return `${date}T15:00:00.000Z`;
}

const reais = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 2183960 → "21.840": whole reais, for the big numbers of the Painel. */
export function formatReais(cents: number): string {
  return reais.format(Math.round(cents / 100));
}

/** "agora", "há 5 min", "há 1 h", "há 3 dias": how long ago a sale happened. */
export function formatTimeAgo(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) {
    return "agora";
  }
  if (minutes < 60) {
    return `há ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `há ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day of an instant in Brasília, as midnight UTC of that date. */
const calendarDay = (iso: string) => Date.parse(`${dayFormat.format(new Date(iso))}T00:00:00Z`);

/** "Hoje", "Amanhã", "Em 6 dias": calendar days until an event, in Brasília. */
export function formatDaysUntil(startsAt: string, now: Date): string {
  const days = Math.round((calendarDay(startsAt) - calendarDay(now.toISOString())) / 86_400_000);
  if (days <= 0) {
    return "Hoje";
  }
  return days === 1 ? "Amanhã" : `Em ${days} dias`;
}

/** "Sáb, 12 out · 21:00": the date and time on a ticket (Figma: Ingresso, 56:409). */
export function formatTicketDateTime(startsAt: string): string {
  const p = parts(startsAt);
  return `${capitalize(p.weekday.slice(0, 3))}, ${p.day} ${p.month.slice(0, 3)} · ${p.hour.padStart(2, "0")}:${p.minute}`;
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
