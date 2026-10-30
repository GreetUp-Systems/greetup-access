import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { ProducerShell } from "../../../_components/producer/ProducerShell";

/**
 * The producer system's pages (SPEC-015 §6): Painel, Eventos, Recebimento and the profile, inside
 * the sidebar or the Barra de abas. Criar perfil stays outside, as a focused screen; the session
 * comes from the producer's layout, shared with it. The sidebar's cookie is read here, so the first
 * paint is already open or closed as it was left.
 */
export default async function ProducerSystemLayout({ children }: { children: ReactNode }) {
  const sidebar = (await cookies()).get("sidebar_state")?.value;
  return <ProducerShell defaultOpen={sidebar !== "false"}>{children}</ProducerShell>;
}
