import type { ReactNode } from "react";

import { ReceivingProvider } from "../../../../_components/producer/receiving/ReceivingProvider";

/**
 * The Recebimento's pages (SPEC-015 §6, R9): the root and the steps share what the producer
 * typed, kept in this layout's memory while the passos go back and forth.
 */
export default function ReceivingLayout({ children }: { children: ReactNode }) {
  return <ReceivingProvider>{children}</ReceivingProvider>;
}
