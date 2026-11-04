"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@access/ui/components/breadcrumb";
import { Button } from "@access/ui/components/button";
import { Progress } from "@access/ui/components/progress";
import { Status, type StatusState } from "@access/ui/components/status";
import { TopBar } from "@access/ui/components/top-bar";
import { cn } from "@access/ui/lib/utils";
import Link from "next/link";
import { type ReactNode, useId } from "react";

import {
  type EventStage,
  eventStages,
  eventsHref,
  STAGE_COUNT,
  stagePosition,
} from "../../../_lib/producer/event-flow";
import { StepCardActions, stepCardClassName, StepsCard } from "../receiving/ReceivingFrame";

/**
 * Desktop: the top of an event's page (Cabeçalho da página of 586:11098 and 591:12579): the trail
 * back to Eventos, the title in Heading/H1 with the event's Status (M) beside it, and the page's
 * actions at the right ("Ver página", once published).
 */
export function EventPageHeader({
  title,
  status,
  actions,
  className,
}: {
  title: string;
  status?: StatusState | undefined;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("hidden items-end gap-4 md:flex", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={eventsHref}>Eventos</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate type-heading-h1 text-text-primary">{title}</h1>
          {status === undefined ? null : <Status status={status} size="m" />}
        </div>
      </div>
      {actions}
    </header>
  );
}

/** Phone: "Etapa N de 3", the stage's name and the progress (Progresso of 586:10877, 588:11433). */
export function StageProgress({ stage, className }: { stage: EventStage; className?: string }) {
  const { number, name } = stagePosition[stage];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-start gap-2 type-label-s">
        <span className="min-w-0 flex-1 text-text-accent">
          Etapa {number} de {STAGE_COUNT}
        </span>
        <span className="text-text-tertiary">{name}</span>
      </p>
      <Progress value={(number / STAGE_COUNT) * 100} aria-hidden />
    </div>
  );
}

interface EventStepFrameProps {
  /** The phone's top bar, the desktop's trail and title: "Novo evento" or the event's name. */
  title: string;
  /** The event's Status beside the desktop's title, once the draft exists. */
  status?: StatusState | undefined;
  stage: EventStage;
  /** The current stage's line in the Etapas list: "1 de 3". */
  passoDetail: string;
  /** A notice of the page (a toast), above the passo. */
  notice?: ReactNode;
  /** The phone's back, in the Barra superior. */
  onBack: () => void;
  children: ReactNode;
}

/**
 * A passo of the event (Novo 586:11098 and 586:10877; Detalhes 588:11718 and 588:11433). Phone: an
 * inner page with the Barra superior and its back, the notice, "Etapa N de 3" and the card, without
 * the tabs. Desktop: the page's header, the notice, and the Etapas list beside the card.
 */
export function EventStepFrame({
  title,
  status,
  stage,
  passoDetail,
  notice,
  onBack,
  children,
}: EventStepFrameProps) {
  return (
    <>
      <TopBar type="navigation" title={title} onBack={onBack} className="-mx-4 -mt-2 md:hidden" />
      <div className="flex flex-col gap-5 pt-3 md:gap-6 md:pt-0">
        <EventPageHeader title={title} status={status} />
        {notice}
        <StageProgress stage={stage} className="md:hidden" />
        <div className="flex flex-col md:flex-row md:items-start md:gap-6">
          <StepsCard
            items={eventStages(stage, passoDetail)}
            className="hidden md:flex md:w-dashboard-aside md:shrink-0"
          />
          <div className="flex min-w-0 flex-col md:flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}

interface EventFormCardProps {
  /** "Rascunho · 1 de 3", "Detalhes · 2 de 4" or "Editar", in Label/S above the title. */
  eyebrow: string;
  title: string;
  description?: string;
  /** On the phone the description gives its room to the form (Nome e categoria, 586:10877). */
  descriptionOnPhone?: boolean;
  /** A notice inside the card, above its header (the desktop's toast of the new draft). */
  notice?: ReactNode;
  children?: ReactNode;
  /** The card's action (Botão/Inverso L, the width of the card on the phone). */
  action: ReactNode;
  /** Desktop: "Voltar" or "Cancelar" before the action; the phone goes back above. */
  onBack?: (() => void) | undefined;
  backLabel?: string;
  /** The line under the action, in Body/S. */
  note?: string;
  /** Wraps the card in a form, so Enter sends it. */
  onSubmit?: () => void;
}

/**
 * Figma: Etapa, the card of a passo or of an edition: Label/S, the title in Heading/H3 and the
 * line in Body/M, the fields, and the actions. bg/surface, radius/xl, space/5 (space/8 on the
 * desktop), as the Recebimento's cards.
 */
export function EventFormCard({
  eyebrow,
  title,
  description,
  descriptionOnPhone = true,
  notice,
  children,
  action,
  onBack,
  backLabel,
  note,
  onSubmit,
}: EventFormCardProps) {
  const titleId = useId();
  const body = (
    <>
      {notice}
      <div className="flex flex-col gap-2">
        <p className="type-label-s text-text-tertiary">{eyebrow}</p>
        <h2 id={titleId} className="type-heading-h3 text-text-primary">
          {title}
        </h2>
        {description === undefined ? null : (
          <p
            className={cn(
              "type-body-m text-text-secondary",
              !descriptionOnPhone && "hidden md:block",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children}
      <StepCardActions
        action={action}
        onBack={onBack}
        {...(backLabel === undefined ? {} : { backLabel })}
        note={note}
      />
    </>
  );
  if (onSubmit !== undefined) {
    return (
      <form
        noValidate
        aria-labelledby={titleId}
        className={stepCardClassName}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {body}
      </form>
    );
  }
  return (
    <section aria-labelledby={titleId} className={stepCardClassName}>
      {body}
    </section>
  );
}

/**
 * The error toast of a call that did not go (SPEC-015 §6: the network, 5xx and 503): the system's
 * "Sem conexão" (430:17034) with "Tentar de novo"; what was typed stays on the screen.
 */
export function ConnectionNotice({
  onRetry,
  retrying = false,
  className,
}: {
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <Alert
      tone="danger"
      className={className}
      action={
        <Button variant="ghost" size="s" loading={retrying} onClick={onRetry}>
          Tentar de novo
        </Button>
      }
    >
      <AlertTitle>Sem conexão</AlertTitle>
      <AlertDescription>
        Não conseguimos falar com o Access. Confira a internet e tente de novo.
      </AlertDescription>
    </Alert>
  );
}

/** The success toast of the new draft (Detalhes · 1 Local, 588:11433 and 588:11718). */
export function DraftCreatedNotice({ className }: { className?: string }) {
  return (
    <Alert tone="success" className={className}>
      <AlertDescription>Rascunho criado. O resto pode ficar para depois.</AlertDescription>
    </Alert>
  );
}

/** The card's main button: Botão/Inverso L, the card's width on the phone. */
export function CardAction({
  children,
  loading = false,
  disabled = false,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <Button
      type={type}
      variant="inverse"
      size="l"
      className="w-full md:w-auto"
      loading={loading}
      disabled={disabled}
      {...(onClick === undefined ? {} : { onClick })}
    >
      {children}
    </Button>
  );
}
