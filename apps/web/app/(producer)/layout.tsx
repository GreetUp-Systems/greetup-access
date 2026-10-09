import "@access/ui/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontVariables } from "../_lib/fonts";

export const metadata: Metadata = {
  title: "Access · Produtor",
};

/**
 * Root layout of the producer system (D-29). No data-theme on <html>: tokens.css follows the
 * system's light or dark preference (SPEC-015 §6), and menus and sheets that open in a portal on
 * <body> follow it too. Going between the site and the system reloads the page.
 */
export default function ProducerRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
