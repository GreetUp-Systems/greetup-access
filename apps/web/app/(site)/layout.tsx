import "@access/ui/globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontVariables } from "../_lib/fonts";

export const metadata: Metadata = {
  title: "Access",
};

/**
 * Root layout of the public site (D-29). Dark only until SPEC-016 16C, which decides the site's light
 * mode with the Início (S15); the producer system has its own root layout that follows the system
 * theme.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
