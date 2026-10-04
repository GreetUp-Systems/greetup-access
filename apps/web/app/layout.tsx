import "@access/ui/styles.css";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import type { ReactNode } from "react";

// The design system's three families (Figma text styles); tokens.css reads these variables.
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-unbounded",
});
const inter = Inter({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Access",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${unbounded.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
