"use client";

import { Button } from "@access/ui/components/button";
import { Minus, Plus } from "lucide-react";

/** Figma: Contador (139:928, 140:931), two Botão de ícone/Secundário M around a Heading/H4 value. */
export function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="icon-m"
        aria-label="Diminuir a quantidade"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <output
        aria-live="polite"
        aria-label={`${value} ${value === 1 ? "ingresso" : "ingressos"}`}
        className="w-control-sm text-center type-heading-h4 text-text-primary"
      >
        {value}
      </output>
      <Button
        variant="secondary"
        size="icon-m"
        aria-label="Aumentar a quantidade"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
