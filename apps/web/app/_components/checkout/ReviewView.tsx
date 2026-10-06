"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { EventThumbnail } from "@access/ui/components/event-cover";
import { TopBar } from "@access/ui/components/top-bar";
import { ArrowLeft } from "lucide-react";

import type { PurchaseView } from "../../_lib/api/purchases";
import { formatEventStart, formatPrice } from "../../_lib/format";
import { AccountCard, EventCard, PixMethodCard } from "./CheckoutParts";
import type { ReviewNotice } from "./useCheckout";

function ReviewNoticeAlert({
  notice,
  ticketTypeName,
}: {
  notice: ReviewNotice;
  ticketTypeName: string;
}) {
  switch (notice) {
    case "sold_out":
      return (
        <Alert tone="danger">
          <AlertTitle>Ingressos esgotados</AlertTitle>
          <AlertDescription>
            Os ingressos de {ticketTypeName} acabaram enquanto você revisava o pedido. Nada foi
            cobrado.
          </AlertDescription>
        </Alert>
      );
    case "total_changed":
      return (
        <Alert tone="warning">
          <AlertTitle>O total mudou</AlertTitle>
          <AlertDescription>
            A cotação do Pix venceu e a taxa foi recalculada. Confira o novo total antes de gerar o
            Pix.
          </AlertDescription>
        </Alert>
      );
    case "connection":
      return (
        <Alert tone="danger">
          <AlertTitle>Sem conexão</AlertTitle>
          <AlertDescription>
            Não conseguimos falar com o Access. Confira a internet e tente de novo; seu pedido
            continua reservado.
          </AlertDescription>
        </Alert>
      );
  }
}

/**
 * Figma: Revisar pedido (145:1592 mobile, 150:2242 desktop) and its toasts (Esgotou 175:2013 /
 * 176:5075, Total mudou 175:4622 / 176:5200, Erro de conexão 175:4714 / 176:5324). One service fee
 * line, paid by the buyer (SPEC-014 §8); the total shown is the one the Pix will charge.
 */
export function ReviewView({
  purchase,
  email,
  notice,
  busy,
  onGeneratePix,
  onBack,
}: {
  purchase: PurchaseView;
  email: string;
  notice: ReviewNotice | null;
  busy: boolean;
  onGeneratePix: () => void;
  onBack: () => void;
}) {
  const total = formatPrice(purchase.totalCents ?? purchase.subtotalCents);
  const fee = formatPrice(purchase.serviceFeeCents ?? 0);
  const line = `${purchase.quantity} × ${purchase.ticketType.name}`;
  const subtotal = formatPrice(purchase.subtotalCents);
  const soldOut = notice === "sold_out";
  const action = soldOut ? onBack : onGeneratePix;
  const label = (desktop: boolean): string =>
    soldOut
      ? desktop
        ? "Escolher outro ingresso"
        : "Escolher outro"
      : notice === "connection"
        ? "Tentar de novo"
        : "Gerar Pix";

  return (
    <>
      <TopBar className="md:hidden" type="navigation" title="Revisar pedido" onBack={onBack} />
      <div className="md:px-4">
        <main className="mx-auto w-full max-w-page-content px-4 pt-4 pb-10 md:px-0 md:pt-5">
          <Button
            className="hidden md:inline-flex"
            variant="secondary"
            size="icon-m"
            aria-label="Voltar ao evento"
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
          <h1 className="hidden type-heading-h1 text-text-primary md:mt-4 md:block">
            Revisar pedido
          </h1>

          <div className="flex flex-col gap-4 md:mt-12 md:flex-row md:items-start md:gap-16">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {notice === null ? null : (
                <ReviewNoticeAlert notice={notice} ticketTypeName={purchase.ticketType.name} />
              )}

              {/* Phone: Pedido, the event and the values in one card. */}
              <section className="rounded-lg border border-border-subtle bg-bg-surface md:hidden">
                <div className="flex items-center gap-3 p-4">
                  <EventThumbnail />
                  <div className="flex min-w-0 flex-col gap-0-5">
                    <h2 className="truncate type-body-l-strong text-text-primary">
                      {purchase.event.name}
                    </h2>
                    <p className="truncate type-body-s text-text-secondary">
                      {formatEventStart(purchase.event.startsAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col border-t border-border-subtle py-2">
                  <div className="flex justify-between px-4 py-1-5">
                    <span className="type-body-m text-text-primary">{line}</span>
                    <span className="type-mono-m text-text-primary">{subtotal}</span>
                  </div>
                  <div className="flex justify-between px-4 py-1-5">
                    <span className="type-body-m text-text-secondary">Taxa de serviço</span>
                    <span className="type-mono-m text-text-secondary">{fee}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
                  <span className="type-body-l-strong text-text-primary">Total</span>
                  <span className="type-heading-h3 text-text-primary">{total}</span>
                </div>
              </section>

              <div className="hidden md:block">
                <EventCard event={purchase.event} />
              </div>
              <AccountCard email={email} />
              <PixMethodCard />
              <p className="type-body-s text-text-tertiary md:hidden">
                Pagamento por Pix. Você recebe o código na próxima tela.
              </p>
            </div>

            {/* Desktop: Resumo do pedido. */}
            <aside className="hidden md:block md:w-1/3 md:shrink-0">
              <section
                aria-label="Resumo do pedido"
                className="flex flex-col rounded-lg border border-border-subtle bg-bg-surface py-6"
              >
                <h2 className="px-6 pb-3 type-heading-h4 text-text-primary">Resumo do pedido</h2>
                <div className="flex justify-between px-6 py-1-5">
                  <span className="type-body-m text-text-primary">{line}</span>
                  <span className="type-mono-m text-text-primary">{subtotal}</span>
                </div>
                <div className="flex justify-between px-6 pt-1-5 pb-3">
                  <span className="type-body-m text-text-secondary">Taxa de serviço</span>
                  <span className="type-mono-m text-text-secondary">{fee}</span>
                </div>
                <div className="h-px bg-border-subtle" />
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="type-body-l-strong text-text-primary">Total</span>
                  <span className="type-heading-h2 text-text-primary">{total}</span>
                </div>
                <div className="px-6">
                  <Button
                    className="w-full"
                    variant="inverse"
                    size="l"
                    loading={busy}
                    onClick={action}
                  >
                    {label(true)}
                  </Button>
                </div>
                <p className="px-6 pt-3 text-center type-body-s text-text-tertiary">
                  Você recebe o código Pix na próxima tela e paga no app do seu banco.
                </p>
              </section>
            </aside>
          </div>
          {/* Room for the phone's payment bar. */}
          <div className="h-bar md:hidden" />
        </main>
      </div>

      {/* Phone: Barra de pagamento, floating over the page. */}
      <div className="fixed inset-x-4 bottom-4 z-20 flex h-bar items-center gap-3 rounded-xl border border-glass-rim bg-glass-surface pr-3 pl-5 shadow-glass-superficie backdrop-blur-glass-superficie md:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-s text-text-secondary">Total</span>
          <span className="truncate type-heading-h3 text-text-primary">{total}</span>
        </div>
        <Button variant="inverse" loading={busy} onClick={action}>
          {label(false)}
        </Button>
      </div>
    </>
  );
}
