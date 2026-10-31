"use client";

import { Button } from "@access/ui/components/button";
import { Progress } from "@access/ui/components/progress";
import { Step, Steps } from "@access/ui/components/step";
import { TopBar } from "@access/ui/components/top-bar";
import { cn } from "@access/ui/lib/utils";
import { type ReactNode, useId } from "react";

import {
  type ReceivingStep,
  type ReceivingStepItem,
  STEP_COUNT,
  stepPosition,
} from "../../../_lib/producer/receiving-flow";

/** Desktop: the page's title and line (Cabeçalho da página of 301:2818). */
export function ReceivingHeader({ className }: { className?: string }) {
  return (
    <header className={cn("hidden flex-col gap-2 md:flex", className)}>
      <h1 className="type-heading-h1 text-text-primary">Recebimento</h1>
      <p className="type-body-m text-text-tertiary">Para onde vai o dinheiro das vendas</p>
    </header>
  );
}

/** Phone: "Etapa N de 5", the step's name and the progress (Progresso of 501:5529). */
export function StepProgress({ step, className }: { step: ReceivingStep; className?: string }) {
  const { number, name } = stepPosition[step];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex items-start gap-2 type-label-s">
        <span className="min-w-0 flex-1 text-text-accent">
          Etapa {number} de {STEP_COUNT}
        </span>
        <span className="text-text-tertiary">{name}</span>
      </p>
      <Progress value={(number / STEP_COUNT) * 100} aria-hidden />
    </div>
  );
}

/** Figma: Etapas, the configuration's list of steps (Etapa, 294:71) in its card. */
export function StepsCard({
  items,
  className,
}: {
  items: readonly ReceivingStepItem[];
  className?: string;
}) {
  return (
    <section
      aria-label="Etapas"
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6",
        className,
      )}
    >
      <h2 className="type-heading-h4 text-text-primary">Etapas</h2>
      <Steps>
        {items.map((item, index) => (
          <Step
            key={item.key}
            state={item.state}
            number={index + 1}
            title={item.title}
            detail={item.detail}
            showLine={index < items.length - 1}
          />
        ))}
      </Steps>
    </section>
  );
}

interface StepPageProps {
  step: ReceivingStep;
  /** The Etapas list beside the step, on the desktop. */
  items: readonly ReceivingStepItem[];
  /** A notice of the page (a failure, the terms not accepted), above the step. */
  notice?: ReactNode;
  /** The phone's back, in the Barra superior. */
  onBack: () => void;
  /** The step's card. */
  children: ReactNode;
}

/**
 * A step of the Recebimento (Termos 301:2818 and 302:4201; Seus dados 550:15088 and 550:13465;
 * Documentos 547:10491 and 547:10342). Phone: an inner page with the Barra superior and its back,
 * the notice, "Etapa N de 5" and the card, without the tabs. Desktop: the page's header, the notice,
 * and the Etapas list beside the card.
 */
export function StepPage({ step, items, notice, onBack, children }: StepPageProps) {
  return (
    <>
      <TopBar
        type="navigation"
        title="Recebimento"
        onBack={onBack}
        className="-mx-4 -mt-2 md:hidden"
      />
      <div className="flex flex-col gap-5 pt-3 md:gap-6 md:pt-0">
        <ReceivingHeader />
        {notice}
        <StepProgress step={step} className="md:hidden" />
        <div className="flex flex-col md:flex-row md:items-start md:gap-6">
          <StepsCard items={items} className="hidden md:flex md:w-dashboard-aside md:shrink-0" />
          <div className="flex min-w-0 flex-col md:flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}

interface StepCardProps {
  /** "Seus dados · 1 de 3", in Label/S above the title. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** On the phone the description gives its room to a notice, so the form still fits (R10). */
  descriptionOnPhone?: boolean;
  /** A notice inside the card, under the title (the previous attempt's data). */
  notice?: ReactNode;
  children?: ReactNode;
  /** The card's action: Botão/Inverso L, the width of the card on the phone. */
  action: ReactNode;
  /** Desktop: "Voltar", the Botão/Fantasma L before the action; the phone goes back above. */
  onBack?: () => void;
  /** The line under the action, in Body/S. */
  note?: string;
  /** Wraps the card's content in a form, so Enter sends it. */
  onSubmit?: () => void;
}

/** Figma: Etapa, the card of a step: the header, the content and the action. */
export function StepCard({
  eyebrow,
  title,
  description,
  descriptionOnPhone = true,
  notice,
  children,
  action,
  onBack,
  note,
  onSubmit,
}: StepCardProps) {
  const titleId = useId();
  const body = (
    <>
      <div className="flex flex-col gap-2">
        {eyebrow === undefined ? null : (
          <p className="type-label-s text-text-tertiary">{eyebrow}</p>
        )}
        <h2 id={titleId} className="type-heading-h3 text-text-primary">
          {title}
        </h2>
        {description === undefined ? null : (
          <p
            className={cn(
              "type-body-m text-text-secondary md:type-body-l",
              !descriptionOnPhone && "hidden md:block",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {notice}
      {children}
      <div className="flex flex-col gap-3 md:items-start">
        <div className="flex gap-3">
          {onBack === undefined ? null : (
            <Button variant="ghost" size="l" className="hidden md:inline-flex" onClick={onBack}>
              Voltar
            </Button>
          )}
          {action}
        </div>
        {note === undefined ? null : (
          <p className="text-center type-body-s text-text-tertiary md:text-left">{note}</p>
        )}
      </div>
    </>
  );
  const className =
    "flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5 md:gap-6 md:p-8";
  if (onSubmit !== undefined) {
    return (
      <form
        noValidate
        aria-labelledby={titleId}
        className={className}
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
    <section aria-labelledby={titleId} className={className}>
      {body}
    </section>
  );
}
