"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button, type ButtonProps } from "@access/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import { Input, type InputProps } from "@access/ui/components/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { Logo } from "@access/ui/components/logo";
import { Status, type StatusState } from "@access/ui/components/status";
import { TopBar } from "@access/ui/components/top-bar";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  Menu,
  Share2,
  Ticket,
  User,
} from "lucide-react";
import type { ReactNode } from "react";

import { IdentificationView } from "../../_components/identification/IdentificationView";
import { SiteHeader } from "../../_components/SiteHeader";

// Hover, focus and pressed are CSS states; the catalog forces them with data-preview-state.
type Preview = "hover" | "pressed" | "focus";
const preview = (state: string): Preview | undefined =>
  state === "hover" || state === "pressed" || state === "focus" ? state : undefined;
const noop = (): void => undefined;

// Widths of the Figma component pages' frames, only to lay the catalog out like Figma: a field
// column (320), a phone (360) and the toast (328, "Largura 328" in its description).
const frame = { field: { width: 320 }, phone: { width: 360 }, toast: { width: 328 } } as const;

type Variant = NonNullable<ButtonProps["variant"]>;

const buttonSets: Array<{ variant: Variant; figma: string }> = [
  { variant: "primary", figma: "Botão/Primário" },
  { variant: "secondary", figma: "Botão/Secundário" },
  { variant: "ghost", figma: "Botão/Fantasma" },
  { variant: "destructive", figma: "Botão/Destrutivo" },
  { variant: "inverse", figma: "Botão/Inverso" },
];
const buttonStates = ["default", "hover", "pressed", "focus", "loading", "disabled"] as const;

const iconSets: Array<{ variant: Variant; figma: string }> = [
  { variant: "primary", figma: "Botão de ícone/Primário" },
  { variant: "secondary", figma: "Botão de ícone/Secundário" },
  { variant: "ghost", figma: "Botão de ícone/Fantasma" },
];
// Figma: rows are the sizes, columns the states (Padrão, Hover, Foco, Desabilitado, Carregando, Pressionado).
const iconStates = ["default", "hover", "focus", "disabled", "loading", "pressed"] as const;
const glassStates = ["default", "pressed", "focus", "disabled"] as const;

// Figma: columns are the sizes, rows the states (Padrão, Preenchido, Hover, Foco, Erro, Desabilitado).
const fieldStates = ["default", "filled", "hover", "focus", "error", "disabled"] as const;
const fieldSizes: Array<NonNullable<InputProps["size"]>> = ["s", "m", "l"];

const itemStates = ["default", "hover", "focus", "selected", "disabled"] as const;

// Figma: Status (46:85), in the order of its page: ticket, payment, event and producer states.
const statuses: StatusState[] = [
  "valid",
  "used",
  "transferred",
  "cancelled",
  "awaiting",
  "paid",
  "expired",
  "failed",
  "draft",
  "published",
  "in_review",
  "approved",
  "pending",
  "rejected",
];

const tones = [
  { tone: "success", title: "Código copiado", message: "Cole no app do seu banco para pagar." },
  { tone: "neutral", title: "Pedido reservado", message: "Seu pedido continua reservado." },
  { tone: "accent", title: "Código enviado", message: "Confira seu e-mail." },
  {
    tone: "danger",
    title: "Não deu para continuar",
    message: "Confira a internet e tente de novo.",
  },
  { tone: "warning", title: "O total mudou", message: "Confira o novo total antes de pagar." },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="grid gap-6">
      <h2 className="type-label-m text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

/** Identification states designed in Figma (SPEC-014 §5 and §6), one at a time over the catalog. */
export type IdentificationPreview =
  "email" | "email-error" | "code" | "code-error" | "resend" | "failure";

export function Catalog({
  theme,
  identification,
  origin,
}: {
  theme: "dark" | "light";
  identification: IdentificationPreview | undefined;
  origin: "checkout" | "login";
}) {
  const codeStep =
    identification === "code" || identification === "code-error" || identification === "resend";
  return (
    <main
      className="grid min-h-dvh content-start gap-12 bg-bg-canvas p-10 text-text-primary"
      data-theme={theme}
    >
      {buttonSets.map(({ variant, figma }) => (
        <Section key={variant} id={variant} title={figma}>
          <div className="grid w-max grid-cols-3 place-items-center gap-x-16 gap-y-8">
            {buttonStates.map((state) =>
              (["s", "m", "l"] as const).map((size) => (
                <Button
                  key={`${state}-${size}`}
                  variant={variant}
                  size={size}
                  loading={state === "loading"}
                  disabled={state === "disabled"}
                  data-preview-state={preview(state)}
                >
                  Comprar ingresso
                </Button>
              )),
            )}
          </div>
        </Section>
      ))}

      {iconSets.map(({ variant, figma }) => (
        <Section key={`icon-${variant}`} id={`icon-${variant}`} title={figma}>
          <div className="grid w-max grid-cols-6 place-items-center gap-x-16 gap-y-8">
            {(["icon-s", "icon-m", "icon-l"] as const).map((size) =>
              iconStates.map((state) => (
                <Button
                  key={`${size}-${state}`}
                  variant={variant}
                  size={size}
                  aria-label="Copiar"
                  loading={state === "loading"}
                  disabled={state === "disabled"}
                  data-preview-state={preview(state)}
                >
                  <Copy />
                </Button>
              )),
            )}
          </div>
        </Section>
      ))}

      <Section id="icon-glass" title="Botão de ícone/Vidro">
        <div className="grid w-max grid-cols-4 place-items-center gap-x-16 gap-y-8">
          {(["glass", "glass-bare"] as const).map((variant) =>
            glassStates.map((state) => (
              <Button
                key={`${variant}-${state}`}
                variant={variant}
                size="icon-glass"
                aria-label="Voltar"
                disabled={state === "disabled"}
                data-preview-state={preview(state)}
              >
                <ChevronLeft />
              </Button>
            )),
          )}
        </div>
      </Section>

      <Section id="text-field" title="Campo de texto">
        <div className="grid w-max grid-cols-3 items-start gap-x-6 gap-y-10">
          {fieldStates.map((state) =>
            fieldSizes.map((size) => (
              <Field key={`${state}-${size}`} disabled={state === "disabled"} style={frame.field}>
                <FieldLabel htmlFor={`field-${state}-${size}`}>E-mail</FieldLabel>
                <Input
                  id={`field-${state}-${size}`}
                  size={size}
                  placeholder="voce@email.com"
                  defaultValue={
                    state === "filled" || state === "focus" || state === "error"
                      ? "voce@email.com"
                      : undefined
                  }
                  aria-invalid={state === "error" || undefined}
                  disabled={state === "disabled"}
                  data-preview-state={preview(state)}
                />
                {state === "error" ? (
                  <FieldError>Digite um e-mail válido.</FieldError>
                ) : (
                  <FieldDescription>Enviaremos o ingresso para este e-mail.</FieldDescription>
                )}
              </Field>
            )),
          )}
        </div>
      </Section>

      <Section id="list-item" title="Item de lista">
        <div className="grid w-max grid-cols-2 items-center gap-x-10 gap-y-8">
          {itemStates.map((state) =>
            (["comfortable", "compact"] as const).map((size) => (
              <Item
                key={`${state}-${size}`}
                asChild
                size={size}
                divider={state === "default" || state === "disabled"}
                selected={state === "selected"}
                aria-disabled={state === "disabled" || undefined}
                style={frame.phone}
              >
                <button type="button" onClick={noop} data-preview-state={preview(state)}>
                  <ItemMedia>
                    <Ticket />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Festival de Inverno</ItemTitle>
                    <ItemDescription>12 out · São Paulo</ItemDescription>
                  </ItemContent>
                  <ItemActions>{state === "selected" ? <Check /> : <ChevronRight />}</ItemActions>
                </button>
              </Item>
            )),
          )}
        </div>
      </Section>

      <Section id="top-bar" title="Barra superior">
        <div className="grid w-max grid-cols-2 gap-x-10 gap-y-6">
          {(["navigation", "brand", "modal"] as const).map((type) =>
            [false, true].map((scrolled) => (
              <div key={`${type}-${scrolled}`} className="relative pt-12" style={frame.phone}>
                {type === "navigation" ? (
                  <TopBar
                    type="navigation"
                    title="Festival de Inverno"
                    onBack={noop}
                    actions={[
                      { label: "Compartilhar", icon: <Share2 />, onClick: noop },
                      { label: "Mais", icon: <Ellipsis />, onClick: noop },
                    ]}
                    scrolled={scrolled}
                  />
                ) : type === "brand" ? (
                  <TopBar
                    type="brand"
                    actions={[
                      { label: "Conta", icon: <User />, onClick: noop },
                      { label: "Menu", icon: <Menu />, onClick: noop },
                    ]}
                    scrolled={scrolled}
                  />
                ) : (
                  <TopBar
                    type="modal"
                    title="Festival de Inverno"
                    onClose={noop}
                    scrolled={scrolled}
                  />
                )}
              </div>
            )),
          )}
        </div>
      </Section>

      <Section id="toast" title="Toast">
        <div className="grid gap-4" style={frame.toast}>
          {tones.map(({ tone, title, message }) => (
            <Alert key={tone} tone={tone}>
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ))}
        </div>
      </Section>

      <Section id="navigation" title="Navegação">
        <div className="grid gap-6">
          <SiteHeader email={null} onSignIn={noop} onAccount={noop} />
          <SiteHeader email="voce@email.com" onSignIn={noop} onAccount={noop} />
        </div>
      </Section>

      <Section id="status" title="Status">
        <div className="grid gap-4">
          {(["s", "m"] as const).map((size) => (
            <div key={size} className="flex flex-wrap gap-3">
              {statuses.map((status) => (
                <Status key={status} status={status} size={size} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section id="logo" title="Logo">
        <div className="flex items-center gap-8">
          <Logo />
          <Logo format="symbol" />
        </div>
      </Section>
      {identification !== undefined ? (
        <IdentificationView
          origin={origin}
          summary={
            origin === "checkout"
              ? { title: "Festival de Inverno", subtitle: "2 × Pista · R$ 80,00" }
              : undefined
          }
          step={codeStep ? "code" : "email"}
          email="voce@email.com"
          onEmailChange={noop}
          emailError={identification === "email-error" ? "Digite um e-mail válido." : undefined}
          code={identification === "resend" ? "" : "482915"}
          onCodeChange={noop}
          codeError={identification === "code-error" ? "Código incorreto ou expirado." : undefined}
          failed={identification === "failure"}
          busy={false}
          resendInMs={identification === "resend" ? 0 : 42_000}
          onSubmit={noop}
          onResend={noop}
          onBack={noop}
          onClose={noop}
        />
      ) : null}
    </main>
  );
}
