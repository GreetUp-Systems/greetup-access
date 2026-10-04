import { type EmailMessage } from "./email.gateway";

export interface TicketsReadyEmailInput {
  to: string;
  eventName: string;
  eventStartsAt: Date;
  ticketTypeName: string;
  quantity: number;
  appPublicUrl: string;
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "full",
  timeStyle: "short",
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** "Your tickets are ready" (SPEC-008 §8): no QR and no amounts, only a link to the app. */
export function ticketsReadyEmail(input: TicketsReadyEmailInput): EmailMessage {
  const link = `${input.appPublicUrl}/me/tickets`;
  const when = dateFormat.format(input.eventStartsAt);
  const tickets = input.quantity === 1 ? "1 ingresso" : `${input.quantity} ingressos`;
  const subject = `Seus ingressos para ${input.eventName} estão prontos`;

  const text = [
    `Seus ingressos para ${input.eventName} estão prontos.`,
    "",
    `${tickets} · ${input.ticketTypeName}`,
    when,
    "",
    `Para ver e apresentar na entrada, acesse: ${link}`,
  ].join("\n");

  const html = [
    "<!doctype html>",
    '<html lang="pt-BR"><body style="font-family:sans-serif;color:#111">',
    `<h1 style="font-size:20px">Seus ingressos para ${escapeHtml(input.eventName)} estão prontos</h1>`,
    `<p>${escapeHtml(tickets)} · ${escapeHtml(input.ticketTypeName)}<br>${escapeHtml(when)}</p>`,
    `<p><a href="${escapeHtml(link)}">Ver meus ingressos</a></p>`,
    '<p style="color:#555;font-size:13px">O QR Code de entrada fica só na sua área do Access.</p>',
    "</body></html>",
  ].join("");

  return { to: input.to, subject, html, text };
}
