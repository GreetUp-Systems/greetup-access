"use client";

import { Button } from "@access/ui/components/button";
import Link from "next/link";

import {
  currentStep,
  type ReceivingStep,
  receivingSteps,
  stepHref,
} from "../../../_lib/producer/receiving-flow";
import { PageHeader } from "../PageHeader";
import { useProducer } from "../ProducerContext";
import { DataScreen } from "./DataScreen";
import { DocumentsScreen } from "./DocumentsScreen";
import { ReceivingHeader, StepProgress, StepsCard } from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import { ReceivingAccountNotice, ReceivingResult } from "./ReceivingResult";
import { TermsScreen } from "./TermsScreen";

/** The current step's card at the phone's root (501:5529, 520:5646, 520:5797, 520:5949). */
const summaries: Record<ReceivingStep, { title: string; description: string; retry?: string }> = {
  terms: {
    title: "Termos da BlindPay",
    description: "Aceite os termos da BlindPay para receber o dinheiro das vendas.",
  },
  data: {
    title: "Seus dados",
    description: "Informe seus dados como estão no documento.",
    retry: "Seus dados da última vez voltam preenchidos. Confira e corrija o que precisar.",
  },
  documents: {
    title: "Documentos",
    description: "Envie a foto do seu documento e uma selfie.",
  },
};

/** The phone's top of the tab: its title and the avatar that opens the account. */
function RootHeader() {
  return (
    <>
      <div className="md:hidden">
        <PageHeader title="Recebimento" description="Para onde vai o dinheiro das vendas" />
      </div>
      <ReceivingHeader />
    </>
  );
}

/**
 * `/producer/receiving` (SPEC-015 §6, R9). While configuring: on the phone the tab's root, with the
 * current step's card, "Continuar" and the Etapas list (Recebimento · Configuração, 501:5529); on
 * the desktop the Etapas list and the current step itself, at its first passo. Otherwise the result
 * of the verification, which part 3 builds.
 */
export function ReceivingRootScreen() {
  const { producer } = useProducer();
  const flow = useReceiving();

  if (!flow.stage.configuring) {
    return (
      <div className="flex flex-col gap-5 md:gap-6">
        <RootHeader />
        <ReceivingResult />
      </div>
    );
  }

  const current = currentStep(flow.progress);
  const summary = summaries[current];
  const href = stepHref(current);

  return (
    <>
      <div className="flex flex-col gap-5 md:hidden">
        <PageHeader title="Recebimento" description="Para onde vai o dinheiro das vendas" />
        <ReceivingAccountNotice />
        <StepProgress step={current} />
        <section
          aria-labelledby="receiving-current-step"
          className="flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5"
        >
          <div className="flex flex-col gap-2">
            <h2 id="receiving-current-step" className="type-heading-h3 text-text-primary">
              {summary.title}
            </h2>
            <p className="type-body-m text-text-secondary">
              {flow.stage.retry && summary.retry !== undefined
                ? summary.retry
                : summary.description}
            </p>
          </div>
          <Button asChild variant="inverse" size="l" className="w-full">
            <Link href={href} onClick={() => flow.reachForward(href)}>
              Continuar
            </Link>
          </Button>
        </section>
        <StepsCard
          items={receivingSteps(producer, flow.progress, {
            shown: current,
            detail: "Agora",
            retry: flow.stage.retry,
          })}
        />
      </div>
      <div className="hidden md:contents">
        {current === "terms" ? <TermsScreen atRoot /> : null}
        {current === "data" ? <DataScreen atRoot /> : null}
        {current === "documents" ? <DocumentsScreen atRoot /> : null}
      </div>
    </>
  );
}
