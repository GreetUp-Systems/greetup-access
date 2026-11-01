"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { Field, FieldError, FieldLabel } from "@access/ui/components/field";
import { FileField } from "@access/ui/components/file-field";
import { NativeSelect, NativeSelectOption } from "@access/ui/components/native-select";
import { Skeleton } from "@access/ui/components/skeleton";
import { Status } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useId } from "react";

import type { OpenRfi, RfiField, RfiSection } from "../../../_lib/api/onboarding";
import { formatDayMonth } from "../../../_lib/format";
import { onboardingFileAccept } from "../../../_lib/producer/onboarding-files";
import { parsePasso, receivingRoot } from "../../../_lib/producer/receiving-flow";
import { rfiConsequence } from "../../../_lib/producer/receiving-result";
import {
  resolveRfiRoute,
  rfiFieldKind,
  rfiFieldProblem,
  rfiHref,
  rfiProblemMessage,
  rfiQuestionCount,
  rfiSectionProblems,
  rfiSectionsDone,
} from "../../../_lib/producer/rfi";
import { TextSkeleton } from "../../TextSkeleton";
import { useProducer } from "../ProducerContext";
import { StepCardActions, stepCardClassName, StepPage } from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import {
  BlindPayMessage,
  BlindPayMessageSkeleton,
  ReceivingAccountNotice,
  useReceivingResult,
  useResultSteps,
} from "./ReceivingResult";
import { useRfi } from "./RfiProvider";
import { TextField } from "./TextField";

const title = "A BlindPay pediu mais informações";

/** The formats an answer's file takes, as in Documentos: the API takes PDF, JPG or PNG. */
const fileFormats = "Fotos em JPG ou PNG; PDF até 3 MB.";

/** One field of a section, as §6 maps it: a list, an Envio de arquivo or a Campo de texto. */
function RfiFieldInput({ field, id }: { field: RfiField; id: string }) {
  const rfi = useRfi();
  const problem = rfi.errors[field.key];
  const message = problem === undefined ? null : rfiProblemMessage(problem);
  const value = rfi.draft.values[field.key] ?? "";
  const kind = rfiFieldKind(field);

  // A corrected field loses its error at once; a new one only shows when leaving it.
  const change = (next: string): void => {
    rfi.setValue(field.key, next);
    if (problem !== undefined) {
      const draft = { ...rfi.draft, values: { ...rfi.draft.values, [field.key]: next } };
      if (rfiFieldProblem(field, draft) === null) {
        rfi.setErrors({ [field.key]: null });
      }
    }
  };

  if (kind === "file") {
    const row = rfi.rows[field.key];
    const failed = row?.state === "error";
    const missing = !failed && message !== null && row?.state !== "uploading";
    return (
      <FileField
        state={missing ? "error" : (row?.state ?? "empty")}
        title={field.label}
        detail={fileFormats}
        fileName={row?.fileName ?? null}
        error={failed ? row.error : message}
        accept={onboardingFileAccept.document}
        onFileSelect={(file) => rfi.chooseFile(field.key, file)}
      />
    );
  }

  if (kind === "list") {
    return (
      <Field>
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        <NativeSelect
          id={id}
          size="m"
          value={value}
          aria-invalid={message === null ? undefined : true}
          aria-describedby={message === null ? undefined : `${id}-error`}
          onChange={(event) => change(event.target.value)}
        >
          <NativeSelectOption value="" disabled>
            Escolha
          </NativeSelectOption>
          {(field.items ?? []).map((item) => (
            <NativeSelectOption key={item.value} value={item.value}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {message === null ? null : <FieldError id={`${id}-error`}>{message}</FieldError>}
      </Field>
    );
  }

  return (
    <TextField
      id={id}
      label={field.label}
      autoComplete="off"
      maxLength={5000}
      value={value}
      error={message}
      onChange={(event) => change(event.target.value)}
      onBlur={() => {
        // The format shows when leaving a filled field; an empty one waits for "Continuar".
        if (value.trim() !== "") {
          rfi.setErrors({ [field.key]: rfiFieldProblem(field, rfi.draft) });
        }
      }}
    />
  );
}

/** "Pergunta N de M", or its esqueleto while the request loads. */
function Eyebrow({ label, className }: { label: string | null; className?: string }) {
  return label === null ? (
    <div className={className}>
      <TextSkeleton text="Pergunta 1 de 3" type="type-label-s" />
    </div>
  ) : (
    <p className={cn("type-label-s text-text-tertiary", className)}>{label}</p>
  );
}

type Question =
  | { kind: "loading" }
  | { kind: "failed" }
  | {
      kind: "section";
      rfi: OpenRfi;
      section: RfiSection | undefined;
      passo: number;
      total: number;
    };

/**
 * Figma: Pendência · Pergunta N de 3 (548:11301 to 548:11967; 543:9892 to 544:10082), Campo vazio
 * (548:12295, 544:10219), Formato (548:12618, 544:10360), and the desktop's Carregando (520:10688)
 * and Falha ao carregar (520:11010). On the desktop the card has the Status, the question, the
 * title and the deadline above BlindPay's section; on the phone, an inner page, only the question
 * and the section.
 */
function QuestionCard({
  question,
  idPrefix,
  onContinue,
  onBack,
}: {
  question: Question;
  /** The fields are `${idPrefix}-<index>`, for the screen to focus the first to correct. */
  idPrefix: string;
  onContinue: () => void;
  onBack: (() => void) | undefined;
}) {
  const { producer } = useProducer();
  const rfi = useRfi();
  const consequence = rfiConsequence(producer);

  let eyebrow: string | null = null;
  let description = consequence;
  let content: ReactNode;
  if (question.kind === "loading") {
    content = (
      <>
        <div className="flex flex-col gap-2">
          <Eyebrow label={null} className="md:hidden" />
          <BlindPayMessageSkeleton />
        </div>
        <div className="flex flex-col gap-2">
          <TextSkeleton text="Pergunta da BlindPay" type="type-body-m-strong" />
          <Skeleton className="h-control-md w-full rounded-md" />
        </div>
        <Skeleton className="w-full rounded-lg px-4 py-3">
          <div className="invisible flex flex-col gap-0-5">
            <span className="type-body-l-strong">.</span>
            <span className="type-body-m">.</span>
          </div>
        </Skeleton>
      </>
    );
  } else if (question.kind === "failed") {
    content = (
      <Alert
        tone="danger"
        action={
          <Button variant="ghost" size="s" onClick={rfi.reload}>
            Tentar de novo
          </Button>
        }
      >
        <AlertTitle>Não deu para carregar o pedido</AlertTitle>
        <AlertDescription>Confira sua conexão e tente de novo.</AlertDescription>
      </Alert>
    );
  } else {
    const { section, passo, total } = question;
    eyebrow = `Pergunta ${passo} de ${total}`;
    description = `Responda até ${formatDayMonth(question.rfi.expiresAt)}. ${consequence} A mensagem abaixo é da equipe de verificação, como foi escrita.`;
    content = (
      <>
        <div className="flex flex-col gap-2">
          <Eyebrow label={eyebrow} className="md:hidden" />
          {section === undefined ? null : (
            <BlindPayMessage label={section.title} messages={[section.description]} />
          )}
        </div>
        {(section?.fields ?? []).map((field, index) => (
          <RfiFieldInput key={field.key} field={field} id={`${idPrefix}-${index}`} />
        ))}
      </>
    );
  }

  const last = question.kind === "section" && question.passo === question.total;
  const action = last ? (
    <Button
      type="submit"
      variant="inverse"
      size="l"
      className="w-full md:w-auto"
      loading={rfi.submission.sending}
    >
      Enviar resposta
    </Button>
  ) : (
    <Button
      type="submit"
      variant="inverse"
      size="l"
      className="w-full md:w-auto"
      disabled={question.kind !== "section"}
    >
      Continuar
    </Button>
  );

  return (
    <form
      noValidate
      aria-labelledby={`${idPrefix}-title`}
      className={stepCardClassName}
      onSubmit={(event) => {
        event.preventDefault();
        if (question.kind === "section") {
          onContinue();
        }
      }}
    >
      <div className="hidden flex-col gap-2 md:flex">
        <Status status="pending" size="m" />
        {question.kind === "failed" ? null : <Eyebrow label={eyebrow} />}
        <h2 id={`${idPrefix}-title`} className="type-heading-h3 text-text-primary">
          {title}
        </h2>
        <p className="type-body-l text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-5 md:gap-4">{content}</div>
      <StepCardActions
        action={action}
        onBack={onBack}
        note={last ? "A resposta é enviada de uma vez só." : undefined}
      />
    </form>
  );
}

/** The submission that did not go (Pergunta 3 · Falha ao enviar, 548:12936 and 544:10487). */
function SubmissionNotice({ passo }: { passo: number }) {
  const rfi = useRfi();
  if (!rfi.submission.failed) {
    return null;
  }
  return (
    <Alert
      tone="danger"
      action={
        <Button
          variant="ghost"
          size="s"
          loading={rfi.submission.sending}
          onClick={() => void rfi.submit(passo)}
        >
          Tentar de novo
        </Button>
      }
    >
      <AlertTitle>Não deu para enviar a resposta</AlertTitle>
      <AlertDescription>
        Suas respostas continuam aqui. Tente de novo em instantes.
      </AlertDescription>
    </Alert>
  );
}

/**
 * BlindPay's request for information, one section per screen (SPEC-015 §6, R10), at
 * `/producer/receiving/rfi?passo=N`: each "Continuar" checks the section and is a new history
 * entry; the last one sends the whole answer at once. On the desktop's root the first question
 * shows at the root's address. Without a request to answer, the root shows what there is.
 */
export function RfiScreen({ atRoot = false }: { atRoot?: boolean }) {
  const flow = useReceiving();
  const rfi = useRfi();
  const router = useRouter();
  const params = useSearchParams();
  const result = useReceivingResult();
  const steps = useResultSteps("rfi");
  const idPrefix = useId();

  const read = rfi.read;
  const pending =
    result === "rfi" && read.status === "loaded" && read.rfi?.status === "pending"
      ? read.rfi
      : null;
  const asked = atRoot ? 1 : parsePasso(params.get("passo"));
  const total = pending === null ? 1 : rfiQuestionCount(pending);
  const done = pending === null ? 0 : Math.min(rfiSectionsDone(pending, rfi.draft), rfi.confirmed);
  const route = resolveRfiRoute(total, done, asked);
  let redirect: string | null = null;
  if (!atRoot) {
    if (result !== "rfi") {
      redirect = receivingRoot;
    } else if (pending !== null && route.kind === "redirect") {
      redirect = route.href;
    }
  }

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  if (redirect !== null) {
    return null;
  }

  const passo = route.kind === "show" ? route.passo : 1;
  const href = atRoot ? receivingRoot : rfiHref(asked);
  const back = (): void => flow.back(href, passo > 1 ? rfiHref(passo - 1) : receivingRoot);

  let question: Question;
  if (read.status === "failed") {
    question = { kind: "failed" };
  } else if (pending === null) {
    question = { kind: "loading" };
  } else {
    question = { kind: "section", rfi: pending, section: pending.request[passo - 1], passo, total };
  }

  const next = (): void => {
    if (question.kind !== "section") {
      return;
    }
    const section = question.section;
    const problems = section === undefined ? {} : rfiSectionProblems(section, rfi.draft);
    if (section !== undefined && Object.keys(problems).length > 0) {
      rfi.setErrors(
        Object.fromEntries(section.fields.map((field) => [field.key, problems[field.key] ?? null])),
      );
      // The first field to correct, when it takes the focus (a list or a text).
      const first = section.fields.findIndex((field) => problems[field.key] !== undefined);
      document.getElementById(`${idPrefix}-${first}`)?.focus();
      return;
    }
    rfi.confirm(passo);
    if (passo < total) {
      flow.go(rfiHref(passo + 1));
    } else {
      void rfi.submit(passo);
    }
  };

  return (
    <StepPage
      step="verification"
      items={steps}
      notice={
        <>
          {atRoot ? <ReceivingAccountNotice /> : null}
          <SubmissionNotice passo={passo} />
        </>
      }
      onBack={back}
    >
      <QuestionCard
        question={question}
        idPrefix={idPrefix}
        onContinue={next}
        onBack={question.kind === "section" && passo > 1 ? back : undefined}
      />
    </StepPage>
  );
}
