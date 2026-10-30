import type { ReactNode } from "react";

import { Providers } from "../../_components/Providers";

/**
 * The session of the producer's pages: Criar perfil and the system share it, so the receiving
 * account that Criar perfil starts goes on in the same activation queue (SPEC-015 R7) when the
 * producer arrives at the Recebimento.
 */
export default function ProducerLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
