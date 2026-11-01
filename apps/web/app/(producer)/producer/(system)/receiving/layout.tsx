import type { ReactNode } from "react";

import { ReceivingProvider } from "../../../../_components/producer/receiving/ReceivingProvider";
import { RfiProvider } from "../../../../_components/producer/receiving/RfiProvider";

/**
 * The Recebimento's pages (SPEC-015 §6, R9): the root and the steps share what the producer
 * typed, kept in this layout's memory while the passos go back and forth; so do the answers to
 * BlindPay's request for information.
 */
export default function ReceivingLayout({ children }: { children: ReactNode }) {
  return (
    <ReceivingProvider>
      <RfiProvider>{children}</RfiProvider>
    </ReceivingProvider>
  );
}
