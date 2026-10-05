"use client";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Check, Ticket } from "lucide-react";

import type { PublicTicketType } from "../../_lib/api/events";
import { formatAvailability, formatPrice } from "../../_lib/format";

/**
 * Figma: Tipos de ingresso. One choice among the types (a radio group): the selected one takes
 * the accent and the check; a sold-out type shows "Esgotado" and cannot be chosen.
 */
export function TicketTypeList({
  types,
  selectedId,
  onSelect,
}: {
  types: readonly PublicTicketType[];
  selectedId: string | null;
  onSelect: (type: PublicTicketType) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tipos de ingresso" className="flex flex-col">
      {types.map((type, index) => {
        const soldOut = type.available <= 0;
        const selected = type.id === selectedId;
        const next = types[index + 1];
        return (
          <Item
            key={type.id}
            asChild
            selected={selected}
            // Figma: a divider between two unselected rows.
            divider={!selected && next !== undefined && next.id !== selectedId}
            aria-disabled={soldOut || undefined}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={soldOut}
              onClick={() => onSelect(type)}
            >
              <ItemMedia>
                <Ticket />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{type.name}</ItemTitle>
                <ItemDescription>{formatAvailability(type.available)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="type-mono-m">{formatPrice(type.priceCents)}</span>
                {selected ? <Check aria-hidden /> : null}
              </ItemActions>
            </button>
          </Item>
        );
      })}
    </div>
  );
}
