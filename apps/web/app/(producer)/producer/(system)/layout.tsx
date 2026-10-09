import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ProducerShell } from "../../../_components/producer/ProducerShell";
import { Providers } from "../../../_components/Providers";

/**
 * The producer system's pages (SPEC-015 §6): Painel, Eventos, Recebimento and the profile, inside
 * the sidebar or the Barra de abas. Criar perfil stays outside, as a focused screen. The sidebar's
 * cookie is read here, so the first paint is already open or closed as it was left.
 */
export default async function ProducerSystemLayout({ children }: { children: ReactNode }) {
  const sidebar = (await cookies()).get("sidebar_state")?.value;
  return (
    <Providers>
      <ProducerShell defaultOpen={sidebar !== "false"}>{children}</ProducerShell>
    </Providers>
  );
}
