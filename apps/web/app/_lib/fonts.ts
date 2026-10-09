import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";

// The design system's three families (Figma text styles); tokens.css reads these variables. Both
// root layouts, the public site and the producer system (D-29), load them.
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

export const fontVariables = `${unbounded.variable} ${inter.variable} ${jetbrainsMono.variable}`;
