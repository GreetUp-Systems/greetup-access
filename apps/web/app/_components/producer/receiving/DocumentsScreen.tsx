"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { FileField } from "@access/ui/components/file-field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@access/ui/components/item";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import type { IdDocumentType } from "../../../_lib/api/onboarding";
import { onboardingFileAccept } from "../../../_lib/producer/onboarding-files";
import type { DocumentSlot } from "../../../_lib/producer/receiving-data";
import {
  documentFileTitle,
  documentsPassos,
  receivingRoot,
  receivingSteps,
  stepHref,
} from "../../../_lib/producer/receiving-flow";
import { useProducer } from "../ProducerContext";
import { StepCard, StepPage } from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import { ReceivingAccountNotice } from "./ReceivingResult";
import { useStepRoute } from "./useStepRoute";

const documentOptions: ReadonlyArray<{ type: IdDocumentType; title: string; detail: string }> = [
  { type: "ID_CARD", title: "RG", detail: "Frente e verso" },
  { type: "DRIVERS", title: "CNH", detail: "Frente e verso" },
  { type: "PASSPORT", title: "Passaporte brasileiro", detail: "A página com a foto" },
];

const formats = {
  document: "Fotos em JPG ou PNG; PDF até 3 MB.",
  selfie: "Fotos em JPG ou PNG.",
} as const;

const continueButton = (disabled: boolean, onClick: () => void): ReactNode => (
  <Button
    variant="inverse"
    size="l"
    className="w-full md:w-auto"
    disabled={disabled}
    onClick={onClick}
  >
    Continuar
  </Button>
);

/** One file row of the verification, as the provider keeps it. */
function FileRowField({ slot, type }: { slot: DocumentSlot; type: IdDocumentType }) {
  const flow = useReceiving();
  const row = flow.rows[slot];
  const kind = slot === "selfie" ? "selfie" : "document";
  return (
    <FileField
      state={row.state}
      title={documentFileTitle(type, slot)}
      detail={formats[kind]}
      fileName={row.fileName}
      error={row.error}
      accept={onboardingFileAccept[kind]}
      onFileSelect={(file) => flow.chooseFile(slot, file)}
    />
  );
}

/**
 * Figma: Documentos · 1 Escolher o documento (547:10491, 547:10342): only Brazilian documents, as a
 * list of options on the screen (R8, Item de lista with Selecionado).
 */
function ChoosePasso({ total, onContinue }: { total: number; onContinue: () => void }) {
  const flow = useReceiving();
  return (
    <StepCard
      eyebrow={`Documentos · 1 de ${total}`}
      title="Qual documento você vai usar?"
      description="Só documentos brasileiros, dentro da validade."
      action={continueButton(flow.documentType === null, onContinue)}
    >
      <div role="radiogroup" aria-label="Documento" className="flex flex-col">
        {documentOptions.map((option, index) => {
          const selected = flow.documentType === option.type;
          return (
            <Item
              key={option.type}
              asChild
              selected={selected}
              divider={index < documentOptions.length - 1}
              className="has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-border-accent"
            >
              <label>
                <input
                  type="radio"
                  name="document-type"
                  value={option.type}
                  checked={selected}
                  className="sr-only"
                  onChange={() => flow.chooseDocument(option.type)}
                />
                <ItemContent>
                  <ItemTitle>{option.title}</ItemTitle>
                  <ItemDescription>{option.detail}</ItemDescription>
                </ItemContent>
                {selected ? (
                  <ItemActions>
                    <Check aria-hidden />
                  </ItemActions>
                ) : null}
              </label>
            </Item>
          );
        })}
      </div>
    </StepCard>
  );
}

/** Figma: Documentos · 2 Frente, 3 Verso and 4 Selfie, with Envio de arquivo in its states. */
function FilePasso({
  type,
  slot,
  passo,
  total,
  onContinue,
  onBack,
}: {
  type: IdDocumentType;
  slot: DocumentSlot;
  passo: number;
  total: number;
  onContinue: () => void;
  onBack: () => void;
}) {
  const flow = useReceiving();
  return (
    <StepCard
      eyebrow={`Documentos · ${passo} de ${total}`}
      title={documentFileTitle(type, slot)}
      description={
        slot === "selfie"
          ? "Seu rosto de frente, com boa luz. Só foto, em JPG ou PNG."
          : "Foto nítida, sem reflexo e com o documento inteiro."
      }
      onBack={onBack}
      action={continueButton(!flow.progress.sent[slot], onContinue)}
    >
      <FileRowField slot={slot} type={type} />
    </StepCard>
  );
}

/** Figma: Documentos · Conferir e enviar (547:12037, 547:11901; passport 548:15924, 548:15804). */
function ReviewPasso({
  type,
  passo,
  total,
  onBack,
}: {
  type: IdDocumentType;
  passo: number;
  total: number;
  onBack: () => void;
}) {
  const flow = useReceiving();
  const slots = documentsPassos(type).filter(
    (item): item is DocumentSlot => item === "front" || item === "back" || item === "selfie",
  );
  const allSent = slots.every((slot) => flow.progress.sent[slot]);
  return (
    <StepCard
      eyebrow={`Documentos · ${passo} de ${total}`}
      title="Confira e envie"
      onBack={onBack}
      action={
        <Button
          variant="inverse"
          size="l"
          className="w-full md:w-auto"
          disabled={!allSent}
          loading={flow.submission.sending}
          onClick={() => void flow.submit()}
        >
          Enviar para verificação
        </Button>
      }
      note="Ao enviar, você confirma que os dados e os documentos são seus."
    >
      <div className="flex flex-col gap-2 md:gap-3">
        {slots.map((slot) => (
          <FileRowField key={slot} slot={slot} type={type} />
        ))}
      </div>
    </StepCard>
  );
}

/** The notice of a submission that did not go (SPEC-015 §6), above the step. */
function SubmissionNotice() {
  const flow = useReceiving();
  switch (flow.submission.problem) {
    case "failed":
      return (
        <Alert
          tone="danger"
          action={
            <Button variant="ghost" size="s" onClick={() => void flow.submit()}>
              Tentar de novo
            </Button>
          }
        >
          <AlertTitle>Não deu para enviar para verificação</AlertTitle>
          <AlertDescription>
            Seus arquivos continuam aqui. Tente de novo em instantes.
          </AlertDescription>
        </Alert>
      );
    case "busy":
      return (
        <Alert tone="warning">
          <AlertTitle>Seu envio anterior ainda está em processamento</AlertTitle>
          <AlertDescription>
            Tente de novo em alguns minutos. Seus arquivos continuam aqui.
          </AlertDescription>
        </Alert>
      );
    case "refused":
      return (
        <Alert
          tone="danger"
          action={
            <Button
              variant="ghost"
              size="s"
              onClick={() => {
                flow.clearSubmissionProblem();
                flow.go(stepHref("data"));
              }}
            >
              Revisar dados
            </Button>
          }
        >
          <AlertTitle>A BlindPay não aceitou o envio</AlertTitle>
          <AlertDescription>Confira seus dados e documentos e envie de novo.</AlertDescription>
        </Alert>
      );
    default:
      return null;
  }
}

/**
 * Figma: Documentos, one screen per item (SPEC-015 R10, §6), at
 * `/producer/receiving/documents?passo=N`: choose the document, its front, its back (RG and CNH),
 * the selfie, and check and send. Each file goes to BlindPay as soon as it is chosen.
 */
export function DocumentsScreen({ atRoot = false }: { atRoot?: boolean }) {
  const { producer, account } = useProducer();
  const flow = useReceiving();
  const route = useStepRoute("documents", atRoot);

  if (route.passo === null) {
    return null;
  }

  const passo = route.passo;
  const type = flow.documentType;
  const passos = documentsPassos(type);
  const total = passos.length;
  const kind = passos[passo - 1] ?? "choose";
  const back = (): void =>
    flow.back(route.href, passo > 1 ? stepHref("documents", passo - 1) : receivingRoot);
  const next = (): void => flow.go(stepHref("documents", passo + 1));

  let card: ReactNode;
  if (kind === "choose" || type === null) {
    card = <ChoosePasso total={total} onContinue={next} />;
  } else if (kind === "review") {
    card = <ReviewPasso type={type} passo={passo} total={total} onBack={back} />;
  } else {
    card = (
      <FilePasso
        type={type}
        slot={kind}
        passo={passo}
        total={total}
        onContinue={next}
        onBack={back}
      />
    );
  }

  return (
    <StepPage
      step="documents"
      items={receivingSteps(producer, flow.progress, {
        shown: "documents",
        detail: `${passo} de ${total}`,
        retry: flow.stage.retry,
        accountStopped: account.stopped,
      })}
      notice={
        <>
          {atRoot ? <ReceivingAccountNotice /> : null}
          {kind === "review" ? <SubmissionNotice /> : null}
        </>
      }
      onBack={back}
    >
      {card}
    </StepPage>
  );
}
