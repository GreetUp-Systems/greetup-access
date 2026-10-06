"use client";

import { Pix } from "@access/ui/components/pix";
import { TopBar } from "@access/ui/components/top-bar";
import { useState } from "react";

import type { PurchaseView } from "../../_lib/api/purchases";
import { orderDescription } from "../../_lib/checkout";
import { formatPrice } from "../../_lib/format";
import { EventCard } from "./CheckoutParts";

// Figma: Como pagar, the desktop's three steps (150:2370).
const steps = [
  "Abra o app do seu banco e escolha pagar com Pix.",
  "Leia o QR Code ao lado ou cole o código copia e cola.",
  "Confirme o pagamento. Esta tela atualiza sozinha quando ele chegar.",
];

/**
 * Figma: Pix (146:2348 mobile, 150:2370 desktop) and Pagamento não concluído (175:4806 /
 * 176:5451). The Pix waits for the payment; what comes after it is SPEC-014 9C.3.
 */
export function PixView({
  purchase,
  failed,
  busy,
  onRetry,
  onClose,
}: {
  purchase: PurchaseView;
  failed: boolean;
  busy: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const code = purchase.pixCode ?? undefined;

  const copy = (): void => {
    if (code === undefined) {
      return;
    }
    void navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <>
      <TopBar className="md:hidden" type="modal" title="Pagar com Pix" onClose={onClose} />
      <div className="md:px-4">
        <main className="mx-auto w-full max-w-page-content px-4 pb-10 md:px-0 md:pt-10">
          <h1 className="hidden type-heading-h1 text-text-primary md:block">
            {failed ? "Pagamento não concluído" : "Finalize o pagamento"}
          </h1>
          <div className="flex flex-col gap-4 md:mt-8 md:flex-row md:items-start md:gap-16">
            <div className="hidden min-w-0 flex-1 flex-col gap-4 md:flex">
              {failed ? null : (
                <section className="rounded-lg border border-border-subtle bg-bg-surface">
                  <h2 className="px-6 pt-6 pb-2 type-heading-h4 text-text-primary">Como pagar</h2>
                  <ol>
                    {steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex items-center gap-4 border-b border-border-subtle px-6 py-3 last:border-b-0"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle type-body-m-strong text-text-primary">
                          {index + 1}
                        </span>
                        <span className="type-body-l text-text-primary">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <EventCard event={purchase.event} />
            </div>
            <Pix
              className="md:w-1/3 md:shrink-0"
              state={failed ? "failed" : copied ? "copied" : "awaiting"}
              total={formatPrice(purchase.totalCents ?? purchase.subtotalCents)}
              description={orderDescription(purchase)}
              code={code}
              onCopy={copy}
              onRetry={onRetry}
              retrying={busy}
            />
          </div>
        </main>
      </div>
    </>
  );
}
