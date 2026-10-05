import { Button, type ButtonProps } from "@access/ui/components/button";
import { notFound } from "next/navigation";

// Dev-only catalog: renders each component the way its Figma page lays it out, for the visual
// comparison at 360 and 1440 (docs/design/README.md). It never ships to production.
const sizes: Array<NonNullable<ButtonProps["size"]>> = ["s", "m", "l"];
const variants: Array<{ variant: NonNullable<ButtonProps["variant"]>; figma: string }> = [
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
    <main
      className="grid min-h-dvh gap-12 bg-bg-canvas p-10 text-text-primary"
      data-theme={theme === "light" ? "light" : "dark"}
    >
      {variants.map(({ variant, figma }) => (
        <section key={variant} className="grid gap-6" id={variant}>
          <h2 className="type-label-m text-text-secondary">{figma}</h2>
          {/* The Figma page lays each set out as 3 sizes (columns) by 6 states (rows). */}
          <div className="grid w-max grid-cols-3 place-items-center gap-x-16 gap-y-8">
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
