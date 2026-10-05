"use client";

import { Button } from "@access/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@access/ui/components/drawer";
import { cn } from "@access/ui/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";

import type { PublicEvent, PublicTicketType } from "../../_lib/api/events";
import { formatPrice } from "../../_lib/format";
import { useSession } from "../../_lib/session";
import {
  clampQuantity,
  defaultTicketType,
  maxQuantity,
  type SaleState,
  startingPrice,
} from "../../_lib/ticket-selection";
import { Identification } from "../identification/Identification";
import { QuantityStepper } from "./QuantityStepper";
import { TicketTypeList } from "./TicketTypeList";

export interface TicketSelection {
  ticketType: PublicTicketType;
  quantity: number;
}

// Figma: the closed-sales texts (Evento indisponível 176:2096/176:5567; evento já começou
// 221:3245/221:3338).
const closed = {
  cancelled: { label: "Vendas encerradas", mobile: "Cancelado", desktop: "Evento cancelado" },
  started: { label: "O evento já começou", mobile: "Vendas encerradas", desktop: "Vendas encerradas" },
} as const;

/**
 * The purchase on the event page (139:928 mobile, 140:931 desktop): a floating glass bar that
 * opens the choice sheet on the phone, and the side card on the desktop. Continuing asks for the
 * e-mail code first (SPEC-014 §7); the checkout itself (creating the purchase) is onCheckout.
 */
export function EventPurchase({
  event,
  sale,
  onCheckout,
}: {
  event: PublicEvent;
  sale: SaleState;
  onCheckout?: (selection: TicketSelection) => void;
}) {
  const { state } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [selected, setSelected] = useState(() => defaultTicketType(event.ticketTypes));
  const [quantity, setQuantity] = useState(1);

  const price = startingPrice(event.ticketTypes);
  const count = clampQuantity(quantity, selected);
  const subtotal = selected === null ? 0 : selected.priceCents * count;

  const select = (type: PublicTicketType): void => {
    setSelected(type);
    setQuantity((current) => clampQuantity(current, type));
  };

  const proceed = (): void => {
    if (selected === null || count === 0) {
      return;
    }
    if (state.status !== "authenticated") {
      setIdentifying(true);
      return;
    }
    onCheckout?.({ ticketType: selected, quantity: count });
  };

  const chooser = (layout: "sheet" | "card") => (
    <>
      <TicketTypeList types={event.ticketTypes} selectedId={selected?.id ?? null} onSelect={select} />
      <div
        className={cn(
          "flex h-16 items-center justify-between",
          layout === "sheet" ? "px-4" : "px-6",
        )}
      >
        <span className="type-body-m-strong text-text-primary">Quantidade</span>
        <QuantityStepper value={count} max={maxQuantity(selected)} onChange={setQuantity} />
      </div>
      <div
        className={cn(
          "flex items-center justify-between border-t border-border-subtle",
          layout === "sheet" ? "px-4 py-3" : "h-12 px-6",
        )}
      >
        <span className="type-body-m text-text-secondary">Subtotal</span>
        <span
          className={cn(
            "text-text-primary",
            layout === "sheet" ? "type-body-m-strong" : "type-heading-h4",
          )}
        >
          {formatPrice(subtotal)}
        </span>
      </div>
    </>
  );

  const onSale = sale === "on_sale";
  const closedTexts = sale === "on_sale" ? null : closed[sale];

  return (
    <>
      {/* Phone: Barra de compra, floating over the page. */}
      <div className="fixed inset-x-4 bottom-4 z-20 flex h-bar items-center gap-3 rounded-xl border border-glass-rim bg-glass-surface pr-3 pl-5 shadow-glass-superficie backdrop-blur-glass-superficie md:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-s text-text-secondary">
            {closedTexts?.label ?? "A partir de"}
          </span>
          <span className="truncate type-heading-h3 text-text-primary">
            {closedTexts?.mobile ?? (price === null ? "" : formatPrice(price))}
          </span>
        </div>
        {onSale ? (
          <Button variant="inverse" onClick={() => setSheetOpen(true)}>
            Comprar ingresso
          </Button>
        ) : null}
      </div>

      {onSale ? (
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent className="md:hidden" aria-describedby={undefined}>
            <DrawerHeader className="h-12">
              <DrawerTitle>Escolha seu ingresso</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon-m" aria-label="Fechar">
                  <X />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="flex flex-col overflow-y-auto">
              {chooser("sheet")}
              <p className="px-4 py-1-5 type-body-s text-text-tertiary">
                A taxa de serviço aparece antes de você pagar.
              </p>
              <div className="px-4 pt-3 pb-4">
                <Button
                  className="w-full"
                  variant="inverse"
                  size="l"
                  disabled={count === 0}
                  onClick={proceed}
                >
                  Continuar
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : null}

      {/* Desktop: Cartão de compra. */}
      <aside className="hidden md:sticky md:top-8 md:block md:w-1/3 md:shrink-0">
        <section
          aria-label="Comprar ingresso"
          className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface py-6"
        >
          <div className="flex flex-col gap-0-5 px-6 pb-5">
            <span className="type-body-s text-text-secondary">
              {closedTexts?.label ?? "A partir de"}
            </span>
            <span className="type-heading-h2 text-text-primary">
              {closedTexts?.desktop ?? (price === null ? "" : formatPrice(price))}
            </span>
          </div>
          {onSale ? (
            <>
              <div className="h-px bg-border-subtle" />
              <h2 className="px-6 pt-5 pb-2 type-heading-h4 text-text-primary">
                Escolha seu ingresso
              </h2>
              {chooser("card")}
              <div className="flex h-bar items-center px-6">
                <Button
                  className="w-full"
                  variant="inverse"
                  size="l"
                  disabled={count === 0}
                  onClick={proceed}
                >
                  Comprar ingresso
                </Button>
              </div>
              <p className="px-6 pb-3 type-body-s text-text-tertiary">
                Pagamento por Pix. A taxa de serviço aparece antes de você pagar.
              </p>
            </>
          ) : (
            <p className="px-6 pb-3 type-body-s text-text-tertiary">
              Os ingressos deste evento não estão mais à venda.
            </p>
          )}
        </section>
      </aside>

      {identifying && selected !== null ? (
        <Identification
          origin="checkout"
          summary={{
            title: event.name,
            subtitle: `${count} × ${selected.name} · ${formatPrice(subtotal)}`,
          }}
          onClose={() => setIdentifying(false)}
          onDone={() => {
            setIdentifying(false);
            onCheckout?.({ ticketType: selected, quantity: count });
          }}
        />
      ) : null}
    </>
  );
}
