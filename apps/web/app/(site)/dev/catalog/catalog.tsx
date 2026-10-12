"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Button, type ButtonProps } from "@access/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
} from "@access/ui/components/carousel";
import { EventCard } from "@access/ui/components/event-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@access/ui/components/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import {
  CalendarFill,
  HouseFill,
  LayoutGridFill,
  TicketFill,
  UserFill,
  WalletFill,
} from "@access/ui/components/fill-icons";
import { Input, type InputProps } from "@access/ui/components/input";
import { Progress } from "@access/ui/components/progress";
import { SegmentedControl, SegmentedControlItem } from "@access/ui/components/segmented-control";
import {
  Sidebar,
  SidebarAccountButton,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@access/ui/components/sidebar";
import { Step, Steps, type StepState } from "@access/ui/components/step";
import { TabBar, TabBarItem } from "@access/ui/components/tab-bar";
import { Tabs, TabsList, TabsTrigger } from "@access/ui/components/tabs";
import { Ticket as TicketCard, type TicketState } from "@access/ui/components/ticket";
import { TooltipProvider } from "@access/ui/components/tooltip";
import { Trend } from "@access/ui/components/trend";
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
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  Share2,
  Ticket,
  User,
  Wallet,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";

import { CheckoutHeaderView } from "../../../_components/checkout/CheckoutHeader";
import { IdentificationView } from "../../../_components/identification/IdentificationView";
import { SiteAccountMenuContent } from "../../../_components/site/SiteAccountMenu";
import { SiteFooter } from "../../../_components/site/SiteFooter";
import { SiteHeader } from "../../../_components/site/SiteHeader";

// Hover, focus and pressed are CSS states; the catalog forces them with data-preview-state.
type Preview = "hover" | "pressed" | "focus";
const preview = (state: string): Preview | undefined =>
  state === "hover" || state === "pressed" || state === "focus" ? state : undefined;
const noop = (): void => undefined;

// Widths of the Figma component pages' frames, only to lay the catalog out like Figma: a field
// column (320), a phone (360), the toast and the segmented control (328, "Largura 328" in their
// descriptions).
const frame = {
  field: { width: 320 },
  phone: { width: 360 },
  toast: { width: 328 },
  segmentedControl: { width: 328 },
  // The sidebar items (224, inside the 256 panel) and room for the open account menu.
  navItem: { width: 224 },
  // Ingresso (56:409): its variants are 340 wide.
  ticket: { width: 340 },
  // Cartão de evento (154:601): the phone (328), a desktop grid card (384), an Anteriores card (282)
  // and the Destaque largo (1200, the page's content).
  card: { width: 328 },
  gridCard: { width: 384 },
  pastCard: { width: 282 },
  wideCard: { width: 1200 },
  menu: { height: 300 },
} as const;

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

// Figma: Ingresso (56:409), Válido · Emitindo · Cancelado. Cancelado gets a code and a QR token to
// show that the QR stays hidden (SPEC-014 M3).
const ticketStates: Array<{ state: TicketState; code: string | null; qrValue?: string }> = [
  { state: "valid", code: "AX-0042", qrValue: "access:ticket:AX-0042" },
  { state: "issuing", code: null },
  { state: "cancelled", code: "AX-0042", qrValue: "access:ticket:AX-0042" },
];

const navStates = ["default", "hover", "focus", "selected"] as const;

// Figma: Controle segmentado (154:520), Selecionada = 1 · 2; then the states it borrows from Aba de
// seção and Barra de abas: hover and pressed on Anteriores, focus on the selected Próximos.
const segmentedPreviews = [
  { selected: "upcoming", state: "default" },
  { selected: "past", state: "default" },
  { selected: "upcoming", state: "hover" },
  { selected: "upcoming", state: "pressed" },
  { selected: "upcoming", state: "focus" },
] as const;
const stepStates: Array<{ state: StepState; action?: string }> = [
  { state: "done" },
  { state: "current", action: "Continuar" },
  { state: "in_progress" },
  { state: "pending" },
  { state: "error", action: "Tentar de novo" },
];

// The sidebar and the tab bar are fixed to the viewport; a transformed box becomes their
// containing block, so each one is drawn in place at Figma's frame size.
const fixedFrame = (width: number, height: number): CSSProperties => ({
  width,
  height,
  transform: "translateZ(0)",
});

function ProducerNav({ collapsed }: { collapsed: boolean }) {
  return (
    <SidebarProvider defaultOpen={!collapsed} className="min-h-0">
      <Sidebar>
        <SidebarTrigger />
        <SidebarHeader>
          <div className="pl-3 group-data-[collapsible=icon]:pl-0">
            {collapsed ? <Logo format="symbol" height={28} /> : <Logo height={28} />}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Painel">
                <LayoutGrid />
                <span>Painel</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Eventos">
                <Calendar />
                <span>Eventos</span>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Recebimento">
                <Wallet />
                <span>Recebimento</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarAccountButton initials="CF" name="Casa Fluida" email="voce@email.com" />
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}

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
  // Menus and tooltips open in a portal on <body>, outside <main>: the theme goes on <html> too.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previous === undefined) {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = previous;
      }
    };
  }, [theme]);
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

      <Section id="event-card" title="Cartão de evento">
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-start gap-8">
            <EventCard
              type="feature"
              heading="h2"
              title="Festival de Inverno"
              coverUrl={null}
              date="Seg, 12 out · 21h"
              place="Casa Fluida · São Paulo"
              countdown="Em 6 dias"
              badges={["2 ingressos", "Pista"]}
              action={
                <Button variant="inverse" size="l">
                  Mostrar ingresso
                </Button>
              }
              style={frame.card}
            />
            <EventCard
              type="feature"
              asChild
              title="Noite de Jazz"
              coverUrl={null}
              date="Qui, 5 nov · 20h"
              place="Blue Note · Rio de Janeiro"
              countdown="Em 30 dias"
              badges={["1 ingresso", "Pista"]}
              style={frame.gridCard}
            >
              <a href="#event-card" />
            </EventCard>
            <div className="flex flex-col gap-3" style={frame.card}>
              <EventCard
                type="row"
                asChild
                state="default"
                title="Noite de Jazz"
                coverUrl={null}
                detail="Qui, 5 nov · Rio de Janeiro"
                tickets="1 ingresso · Pista"
              >
                <a href="#event-card" />
              </EventCard>
              <EventCard
                type="row"
                asChild
                state="past"
                title="Show de Verão"
                coverUrl={null}
                detail="Dom, 21 dez · Salvador"
              >
                <a href="#event-card" />
              </EventCard>
              <EventCard
                type="row"
                asChild
                state="cancelled"
                title="Workshop de Foto"
                coverUrl={null}
                detail="Ter, 28 out · Belo Horizonte"
              >
                <a href="#event-card" />
              </EventCard>
            </div>
            <EventCard
              type="row"
              state="past"
              title="Noite de Poesia"
              coverUrl={null}
              detail="Sex, 9 mai · São Paulo"
              style={frame.pastCard}
            />
          </div>
          <EventCard
            type="wide"
            heading="h2"
            title="Festival de Inverno"
            coverUrl={null}
            date="Seg, 12 de outubro, 21h"
            place="Casa Fluida · Rua Augusta, 1200, São Paulo"
            countdown="Em 6 dias"
            badges={["2 ingressos", "Pista"]}
            action={
              <Button variant="inverse" size="l">
                Mostrar ingresso
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" size="l">
                Ver evento
              </Button>
            }
            className="hidden md:flex"
            style={frame.wideCard}
          />
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

      <Section id="carousel" title="Carrossel · Ponto de paginação">
        <div className="flex flex-wrap items-start gap-10">
          {[0, 1].map((startIndex) => (
            <Carousel
              key={startIndex}
              opts={{ startIndex }}
              aria-label="Ingressos do evento"
              style={frame.card}
            >
              <CarouselContent>
                {["Ingresso 1", "Ingresso 2", "Ingresso 3"].map((label) => (
                  <CarouselItem key={label}>
                    <div className="flex h-qr-plate items-center justify-center rounded-lg border border-border-subtle bg-bg-surface type-body-m text-text-secondary">
                      {label}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselDots className="mt-4" />
            </Carousel>
          ))}
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

      <Section id="site-header" title="Cabeçalho do site">
        {/* The 16A state (SPEC-016 S5): without the search and "Para produtores". Desktop only. */}
        <div className="grid gap-6">
          <SiteHeader account={{ kind: "loading" }} onSignIn={noop} onSignOut={noop} />
          <SiteHeader account={{ kind: "visitor" }} onSignIn={noop} onSignOut={noop} />
          <SiteHeader
            account={{ kind: "member", email: "ana@email.com", profile: "buyer" }}
            onSignIn={noop}
            onSignOut={noop}
          />
          <SiteHeader
            account={{
              kind: "member",
              email: "voce@email.com",
              profile: { producerName: "Casa Fluida" },
            }}
            onSignIn={noop}
            onSignOut={noop}
          />
        </div>
      </Section>

      <Section id="site-footer" title="Rodapé do site">
        <SiteFooter />
      </Section>

      <Section id="checkout-header" title="Cabeçalho do checkout">
        <div className="grid gap-6">
          <CheckoutHeaderView email={null} onSignIn={noop} onAccount={noop} />
          <CheckoutHeaderView email="voce@email.com" onSignIn={noop} onAccount={noop} />
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

      <Section id="ticket" title="Ingresso">
        <div className="flex flex-wrap items-start gap-8">
          {ticketStates.map(({ state, code, qrValue }) => (
            <TicketCard
              key={state}
              state={state}
              eventName="Festival de Inverno"
              dateTime="Seg, 12 out · 21:00"
              place="Casa Fluida · São Paulo"
              ticketTypeName="Pista"
              code={code}
              qrValue={qrValue}
              style={frame.ticket}
            />
          ))}
        </div>
      </Section>

      <Section id="logo" title="Logo">
        <div className="flex items-center gap-8">
          <Logo />
          <Logo format="symbol" />
        </div>
      </Section>

      <Section id="avatar" title="Avatar · Tendência · Progresso">
        <div className="flex flex-wrap items-center gap-8">
          {(["s", "m"] as const).map((size) => (
            <Avatar key={size} size={size}>
              <AvatarFallback>CF</AvatarFallback>
            </Avatar>
          ))}
          <Trend direction="positive">12%</Trend>
          <Trend direction="negative">12%</Trend>
          <Trend direction="neutral">12%</Trend>
          <Progress value={40} aria-label="40%" style={{ width: 120 }} />
        </div>
      </Section>

      <Section id="tabs" title="Aba de seção">
        <Tabs defaultValue="on-sale">
          <TabsList>
            <TabsTrigger value="on-sale" count={2}>
              À venda
            </TabsTrigger>
            <TabsTrigger value="drafts" count={1}>
              Rascunhos
            </TabsTrigger>
            <TabsTrigger value="ended" count={4}>
              Encerrados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Section>

      <Section id="segmented-control" title="Controle segmentado">
        <div className="grid w-max grid-cols-2 gap-x-10 gap-y-6">
          {segmentedPreviews.map(({ selected, state }) => (
            <Tabs
              key={`${selected}-${state}`}
              defaultValue={selected}
              style={frame.segmentedControl}
            >
              <SegmentedControl aria-label="Meus ingressos">
                <SegmentedControlItem
                  value="upcoming"
                  data-preview-state={state === "focus" ? preview(state) : undefined}
                >
                  Próximos
                </SegmentedControlItem>
                <SegmentedControlItem
                  value="past"
                  data-preview-state={state === "focus" ? undefined : preview(state)}
                >
                  Anteriores
                </SegmentedControlItem>
              </SegmentedControl>
            </Tabs>
          ))}
        </div>
      </Section>

      <TooltipProvider>
        <Section id="sidebar" title="Barra lateral">
          <div className="flex gap-6">
            <div style={fixedFrame(292, 900)}>
              <ProducerNav collapsed={false} />
            </div>
            <div style={fixedFrame(108, 900)}>
              <ProducerNav collapsed />
            </div>
          </div>
        </Section>

        <Section id="nav-item" title="Item de navegação · Conta na barra lateral">
          <SidebarProvider className="min-h-0 flex-col gap-4">
            <div className="grid w-max grid-cols-4 gap-6">
              {navStates.map((state) => (
                <div key={state} style={frame.navItem}>
                  <SidebarMenuButton
                    isActive={state === "selected"}
                    data-preview-state={preview(state)}
                  >
                    <LayoutGrid />
                    <span>Painel</span>
                    <SidebarMenuBadge>3</SidebarMenuBadge>
                  </SidebarMenuButton>
                </div>
              ))}
            </div>
            <div className="flex gap-6">
              <div style={frame.navItem}>
                <SidebarAccountButton initials="CF" name="Casa Fluida" email="voce@email.com" />
              </div>
              <div style={frame.navItem}>
                <SidebarAccountButton
                  initials="CF"
                  name="Casa Fluida"
                  email="voce@email.com"
                  data-state="open"
                />
              </div>
            </div>
          </SidebarProvider>
        </Section>
      </TooltipProvider>

      <Section id="account-menu" title="Menu da conta">
        <div style={frame.menu}>
          <DropdownMenu open modal={false}>
            <DropdownMenuTrigger className="sr-only">Conta</DropdownMenuTrigger>
            <DropdownMenuContent className="w-sidebar">
              <DropdownMenuLabel>
                <Avatar>
                  <AvatarFallback>CF</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate type-body-m-strong text-text-primary">Casa Fluida</span>
                  <span className="truncate type-body-s text-text-tertiary">voce@email.com</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-preview-state="hover">
                <User />
                Perfil do produtor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Ticket />
                Meus ingressos
              </DropdownMenuItem>
              <DropdownMenuItem>
                <House />
                Ir para o site
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOut />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Section>

      <Section id="site-account-menu" title="Menu da conta · Site">
        <div className="flex gap-16" style={frame.menu}>
          <div className="w-sidebar">
            <DropdownMenu open modal={false}>
              <DropdownMenuTrigger className="sr-only">Conta</DropdownMenuTrigger>
              <SiteAccountMenuContent
                email="ana@email.com"
                profile="buyer"
                onSignOut={noop}
                align="start"
              />
            </DropdownMenu>
          </div>
          <div className="w-sidebar">
            <DropdownMenu open modal={false}>
              <DropdownMenuTrigger className="sr-only">Conta</DropdownMenuTrigger>
              <SiteAccountMenuContent
                email="voce@email.com"
                profile={{ producerName: "Casa Fluida" }}
                onSignOut={noop}
                align="start"
              />
            </DropdownMenu>
          </div>
        </div>
      </Section>

      <Section id="tab-bar" title="Barra de abas">
        <div style={fixedFrame(360, 104)}>
          <TabBar className="md:flex">
            <TabBarItem href="#tab-bar">
              <HouseFill />
              <span>Início</span>
            </TabBarItem>
            <TabBarItem href="#tab-bar">
              <TicketFill />
              <span>Ingressos</span>
            </TabBarItem>
            <TabBarItem href="#tab-bar" selected>
              <UserFill />
              <span>Conta</span>
            </TabBarItem>
          </TabBar>
        </div>
        <div style={fixedFrame(360, 104)}>
          <TabBar className="md:flex">
            <TabBarItem href="#tab-bar" selected>
              <LayoutGridFill />
              <span>Painel</span>
            </TabBarItem>
            <TabBarItem href="#tab-bar">
              <CalendarFill />
              <span>Eventos</span>
            </TabBarItem>
            <TabBarItem href="#tab-bar">
              <WalletFill />
              <span>Recebimento</span>
            </TabBarItem>
          </TabBar>
        </div>
      </Section>

      <Section id="steps" title="Etapa">
        <Steps style={{ width: 560 }}>
          {stepStates.map(({ state, action }) => (
            <Step
              key={state}
              state={state}
              number={3}
              title="Seus dados"
              detail="Nome, CPF e endereço"
              action={
                action === undefined ? undefined : (
                  <Button variant="secondary" size="s">
                    {action}
                  </Button>
                )
              }
            />
          ))}
        </Steps>
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
