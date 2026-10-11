import type { ReactNode } from "react";

import { Providers } from "../../_components/Providers";
import { BuyerShell } from "../../_components/site/BuyerShell";

/**
 * The buyer area of the public site (SPEC-016 16A): the Conta now, Meus ingressos and the ticket
 * with SPEC-014 9D. One session for all its pages, inside the site's frame.
 */
export default function BuyerAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <BuyerShell>{children}</BuyerShell>
    </Providers>
  );
}
