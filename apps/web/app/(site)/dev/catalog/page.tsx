import { notFound } from "next/navigation";

import { Catalog, type IdentificationPreview } from "./catalog";

const identificationStates: readonly IdentificationPreview[] = [
  "email",
  "email-error",
  "code",
  "code-error",
  "resend",
  "failure",
];

// Dev-only catalog: renders each component the way its Figma page lays it out, for the visual
// comparison at 360 and 1440 (docs/design/README.md). It never ships to production.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; identificacao?: string; origem?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { theme, identificacao, origem } = await searchParams;
  return (
    <Catalog
      theme={theme === "light" ? "light" : "dark"}
      // ?identificacao=<state> opens one identification state for the comparison with Figma.
      identification={identificationStates.find((state) => state === identificacao)}
      origin={origem === "login" ? "login" : "checkout"}
    />
  );
}
