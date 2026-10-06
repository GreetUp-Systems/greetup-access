import { EventThumbnail } from "@access/ui/components/event-cover";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Check, QrCode, User } from "lucide-react";

import type { PurchaseView } from "../../_lib/api/purchases";
import { formatEventStart } from "../../_lib/format";

/** "Sáb, 12 de outubro, 21h · Casa Fluida": the date and the place, without the city (SPEC-014 §7). */
export function eventLine(event: PurchaseView["event"]): string {
  const start = formatEventStart(event.startsAt);
  return event.venueName === null ? start : `${start} · ${event.venueName}`;
}

/** Figma: Evento, the order's event on the desktop (150:2242 Linha; 150:2370). */
export function EventCard({ event }: { event: PurchaseView["event"] }) {
  return (
    <section className="flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5">
      <EventThumbnail />
      <div className="flex min-w-0 flex-col gap-0-5">
        <h2 className="truncate type-heading-h4 text-text-primary">{event.name}</h2>
        <p className="truncate type-body-m text-text-secondary">{eventLine(event)}</p>
      </div>
    </section>
  );
}

/** Figma: Conta, where the tickets will be (Item de lista, compact on the phone). */
export function AccountCard({ email }: { email: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface">
      <Item size="compact" className="md:hidden">
        <ItemMedia>
          <User />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{email}</ItemTitle>
          <ItemDescription>Seus ingressos ficam nessa conta</ItemDescription>
        </ItemContent>
      </Item>
      <Item className="hidden md:flex">
        <ItemMedia>
          <User />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{email}</ItemTitle>
          <ItemDescription>Seus ingressos ficam salvos nessa conta</ItemDescription>
        </ItemContent>
      </Item>
    </div>
  );
}

/** Figma: Forma de pagamento, the only one, already chosen (desktop). */
export function PixMethodCard() {
  return (
    <div className="hidden rounded-lg border border-border-subtle bg-bg-surface md:block">
      <Item selected>
        <ItemMedia>
          <QrCode />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Pix</ItemTitle>
          <ItemDescription>Aprovação na hora, sem cartão e sem CPF</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Check aria-hidden />
        </ItemActions>
      </Item>
    </div>
  );
}
