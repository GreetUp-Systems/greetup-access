import localFont from "next/font/local";

// The design system's three families (Figma text styles); tokens.css reads these variables. Both
// root layouts, the public site and the producer system (D-29), load them. The files are the latin
// subsets next/font/google used to download (Unbounded v12, Inter v20, JetBrains Mono v24; Google
// Fonts serves other builds to Windows browsers), kept in ../_fonts with their OFL licenses so the
// build never fetches them. Each is a variable font, declared at the two weights the text styles
// use, as Google Fonts declares it.
const unbounded = localFont({
  src: [
    { path: "../_fonts/unbounded-latin.woff2", weight: "500" },
    { path: "../_fonts/unbounded-latin.woff2", weight: "600" },
  ],
  variable: "--font-unbounded",
});
const inter = localFont({
  src: [
    { path: "../_fonts/inter-latin.woff2", weight: "400" },
    { path: "../_fonts/inter-latin.woff2", weight: "600" },
  ],
  variable: "--font-inter",
});
const jetbrainsMono = localFont({
  src: [
    { path: "../_fonts/jetbrains-mono-latin.woff2", weight: "400" },
    { path: "../_fonts/jetbrains-mono-latin.woff2", weight: "500" },
  ],
  variable: "--font-jetbrains-mono",
});

export const fontVariables = `${unbounded.variable} ${inter.variable} ${jetbrainsMono.variable}`;
