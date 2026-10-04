import { Button, type ButtonSize, type ButtonVariant } from "@access/ui";
import { notFound } from "next/navigation";

import styles from "./catalog.module.css";

// Dev-only catalog: renders each component the way its Figma page lays it out, for the visual
// comparison at 360 and 1440 (docs/design/README.md). It never ships to production.
const sizes: ButtonSize[] = ["s", "m", "l"];
const variants: Array<{ variant: ButtonVariant; figma: string }> = [
  { variant: "primary", figma: "Botão/Primário" },
  { variant: "secondary", figma: "Botão/Secundário" },
  { variant: "ghost", figma: "Botão/Fantasma" },
  { variant: "destructive", figma: "Botão/Destrutivo" },
  { variant: "inverse", figma: "Botão/Inverso" },
];
const states = ["default", "hover", "pressed", "focus", "loading", "disabled"] as const;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const { theme } = await searchParams;

  return (
    <main className={styles.page} data-theme={theme === "light" ? "light" : "dark"}>
      {variants.map(({ variant, figma }) => (
        <section key={variant} className={styles.section} id={variant}>
          <h2 className={styles.title}>{figma}</h2>
          <div className={styles.grid}>
            {states.map((state) =>
              sizes.map((size) => (
                <Button
                  key={`${state}-${size}`}
                  variant={variant}
                  size={size}
                  loading={state === "loading"}
                  disabled={state === "disabled"}
                  data-preview-state={
                    state === "hover" || state === "pressed" || state === "focus"
                      ? state
                      : undefined
                  }
                >
                  Comprar ingresso
                </Button>
              )),
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
