"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { type ComponentProps, useId } from "react";

import { Button } from "@access/ui/components/button";
import { QrCode } from "@access/ui/components/qr-code";
import { Status } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";

/** Figma: Estado. Expirado and Pago come with the payment follow-up (SPEC-014 9C.3). */
type PixState = "awaiting" | "copied" | "failed";

type PixProps = Omit<ComponentProps<"section">, "children"> & {
  state: PixState;
  /** The total, formatted ("R$ 264,00"). */
  total: string;
  /** "Festival de Inverno · 2 × Pista". */
  description: string;
  /** The Pix copia e cola; the QR is drawn from it. Required while awaiting. */
  code?: string | undefined;
  onCopy?: () => void;
  onRetry?: () => void;
  /** "Tentar novamente" is starting a new order. */
  retrying?: boolean;
};

/**
 * Figma: Pix (61:678). The payment card of the checkout. Each state keeps its own texts and the
 * badge's tone; the expiry countdown (Tempo) stays hidden until the Pix validity is measured
 * (SPEC-014 A4).
 */
function Pix({
  state,
  total,
  description,
  code,
  onCopy,
  onRetry,
  retrying = false,
  className,
  ...props
}: PixProps) {
  const titleId = useId();
  const copied = state === "copied";

  return (
    <section
      data-slot="pix"
      data-state={state}
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 rounded-md border border-border-subtle bg-bg-surface p-6",
        state === "failed" && "border-border-danger",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <h2 id={titleId} className="flex-1 type-heading-h4 text-text-primary">
          Pague com Pix
        </h2>
        <Status status={state === "failed" ? "failed" : "awaiting"} size="s" />
      </div>

      <div className="flex flex-col gap-1">
        <span className="type-body-s text-text-secondary">Total</span>
        <span className="type-heading-h2 text-text-primary">{total}</span>
        <span className="type-body-s text-text-secondary">{description}</span>
      </div>

      {state === "failed" ? (
        <>
          <div className="flex min-h-qr-plate flex-col items-center justify-center gap-4">
            <span className="flex size-state-circle items-center justify-center rounded-full bg-bg-danger-subtle text-icon-danger [&_svg]:size-icon-xl">
              <TriangleAlert aria-hidden />
            </span>
            <p className="type-heading-h4 text-text-danger">Não concluído</p>
          </div>
          <Button variant="inverse" size="l" loading={retrying} onClick={onRetry}>
            Tentar novamente
          </Button>
          <p className="type-body-s text-text-danger">
            O pagamento não foi concluído. Tente novamente ou volte ao evento.
          </p>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <div className="flex size-qr-plate items-center justify-center rounded-lg border border-border-subtle bg-(--palette-brand-creme)">
              {code === undefined ? null : (
                <QrCode value={code} label="QR Code do Pix" className="size-qr" />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {copied ? (
              <span className="flex items-center gap-1-5 type-body-s text-text-success [&_svg]:size-icon-sm [&_svg]:text-icon-success">
                <Check aria-hidden />
                Copiado
              </span>
            ) : (
              <span className="type-body-s text-text-secondary">Pix copia e cola</span>
            )}
            <div className="flex h-control-md items-center rounded-md bg-bg-subtle px-4">
              <span className="truncate type-mono-m text-text-secondary">{code}</span>
            </div>
          </div>
          <Button
            variant="inverse"
            size="l"
            iconLeft={copied ? <Check /> : <Copy />}
            onClick={onCopy}
          >
            {copied ? "Código copiado" : "Copiar código"}
          </Button>
          <p className="type-body-s text-text-tertiary">
            {copied
              ? "Código copiado. Cole no app do seu banco para pagar."
              : "Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código."}
          </p>
        </>
      )}
    </section>
  );
}

export { Pix, type PixProps, type PixState };
