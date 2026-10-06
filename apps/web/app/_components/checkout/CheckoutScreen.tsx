"use client";

import { notFound, useRouter } from "next/navigation";

import { useSession } from "../../_lib/session";
import { AppHeader } from "../AppHeader";
import { Identification } from "../identification/Identification";
import { FollowUpView } from "./FollowUpView";
import { PixView } from "./PixView";
import { ReviewView } from "./ReviewView";
import { useCheckout } from "./useCheckout";
import { useFollowUp } from "./useFollowUp";

/**
 * `/checkout/[purchaseId]`: one screen that follows the order without reloading (SPEC-014 §5).
 * Opened without a session, it asks for the e-mail code first, with origin "checkout".
 */
export function CheckoutScreen({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const { state } = useSession();
  const { loaded, notice, busy, generatePix, retryPurchase, toEvent, show } =
    useCheckout(purchaseId);
  const { ticket } = useFollowUp(loaded.status === "ready" ? loaded.purchase : null, show);

  if (loaded.status === "missing") {
    notFound();
  }
  if (loaded.status === "failed") {
    throw new Error("The order could not be loaded.");
  }

  const header = <AppHeader mobileBar={false} />;

  if (state.status === "anonymous") {
    return (
      <>
        {header}
        <Identification origin="checkout" onClose={() => router.back()} onDone={() => undefined} />
      </>
    );
  }
  if (state.status !== "authenticated" || loaded.status !== "ready") {
    return header;
  }

  const { purchase } = loaded;
  const back = (): void => toEvent(purchase);

  if (purchase.status === "initiated") {
    return (
      <>
        {header}
        <ReviewView
          purchase={purchase}
          email={state.account.user.email}
          notice={notice}
          busy={busy}
          onGeneratePix={() => void generatePix()}
          onBack={back}
        />
      </>
    );
  }

  if (purchase.status === "payment_confirmed" || purchase.status === "ticket_issued") {
    return (
      <>
        {header}
        <FollowUpView
          purchase={purchase}
          ticket={purchase.status === "ticket_issued" ? ticket : null}
          onTickets={() => router.push("/me/tickets")}
          onBack={back}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <PixView
        purchase={purchase}
        failed={purchase.status === "payment_failed" || purchase.status === "payment_refunded"}
        busy={busy}
        onRetry={() => void retryPurchase()}
        onClose={back}
      />
    </>
  );
}
