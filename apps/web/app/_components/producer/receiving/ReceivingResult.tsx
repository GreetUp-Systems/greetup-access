"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { Skeleton } from "@access/ui/components/skeleton";
import { Status } from "@access/ui/components/status";
import { cn } from "@access/ui/lib/utils";
import { LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { getCustomerAttempt } from "../../../_lib/api/onboarding";
import { formatDayMonth, formatShortDayMonth } from "../../../_lib/format";
import { stepHref } from "../../../_lib/producer/receiving-flow";
import {
  accountNotice,
  type ReceivingResult as Result,
  receivingResult,
  resultSteps,
  rfiConsequence,
} from "../../../_lib/producer/receiving-result";
import { rfiHref } from "../../../_lib/producer/rfi";
import { useSession } from "../../../_lib/session";
import { PageHeader } from "../PageHeader";
import { useProducer } from "../ProducerContext";
import {
  ReceivingHeader,
  StepCard,
  StepCardActions,
  stepCardClassName,
  StepsCard,
} from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import { useRfi } from "./RfiProvider";

/** The result the root shows, from the producer, the configuration and the request read. */
export function useReceivingResult(): Result {
  const { producer } = useProducer();
  const flow = useReceiving();
  const rfi = useRfi();
  return receivingResult(producer, { open: flow.stage.open, rfi: rfi.read });
}

/** The request's deadline (`expiresAt`), once it is read. */
function useRfiDeadline(): string | null {
  const { read } = useRfi();
  return read.status === "loaded" && read.rfi !== null ? read.rfi.expiresAt : null;
}

/** The Etapas beside a result (or a question of the request), with the account's notice. */
export function useResultSteps(result: Result) {
  const { producer, account } = useProducer();
  const deadline = useRfiDeadline();
  return resultSteps(producer, {
    result,
    rfiDeadline: deadline === null ? null : formatShortDayMonth(deadline),
    notice: accountNotice(producer, account),
  });
}

/**
 * The notice of the receiving account above the root's content (§6 "Conta de recebimento"): the
 * toast "Conta de recebimento" when the account failed (Conta com erro, 302:5193 and 301:4545; in
 * analysis above the result, 520:8833 and 520:9204; R3) or its resume gave up (R6), and Liberando ·
 * Falha (501:5323, 498:4144) when BlindPay's wallet could not be registered. "Tentar de novo"
 * prepares the account again, with the signature, in the Recebimento.
 */
export function ReceivingAccountNotice() {
  const { producer, account } = useProducer();
  const notice = accountNotice(producer, account);
  if (notice === null) {
    return null;
  }
  const retry = (
    <Button variant="ghost" size="s" loading={account.running} onClick={account.retry}>
      Tentar de novo
    </Button>
  );
  return notice === "account" ? (
    <Alert tone="danger" action={retry}>
      <AlertTitle>Conta de recebimento</AlertTitle>
      <AlertDescription>
        Não deu para preparar sua conta agora. As outras etapas seguem enquanto isso.
      </AlertDescription>
    </Alert>
  ) : (
    <Alert tone="danger" action={retry}>
      <AlertTitle>Não deu para liberar o recebimento</AlertTitle>
      <AlertDescription>
        Sua verificação está aprovada. Tente de novo em instantes.
      </AlertDescription>
    </Alert>
  );
}

/** "Criar evento" (Botão/Inverso L with plus): a draft can be made before the approval. */
function CreateEventAction() {
  return (
    <Button asChild variant="inverse" size="l" className="w-full md:w-auto">
      <Link href="/producer/events/new">
        <Plus aria-hidden />
        Criar evento
      </Link>
    </Button>
  );
}

/** Figma: Enquanto isso, inside the card of a result that waits on BlindPay. */
function MeanwhileBox() {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-bg-subtle p-4">
      <p className="type-body-l-strong text-text-primary">Enquanto isso, monte seu evento</p>
      <p className="type-body-m text-text-secondary">
        Você já pode criar o rascunho. Publicar fica liberado quando a verificação for aprovada.
      </p>
    </div>
  );
}

/**
 * Figma: Mensagem da BlindPay, BlindPay's text as it came, under its label in Label/S: the reasons
 * of a refusal and each section of a request for information.
 */
export function BlindPayMessage({
  label,
  messages,
  className,
}: {
  label: string;
  messages: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md bg-bg-subtle p-4", className)}>
      <p className="type-label-s wrap-break-word text-text-tertiary">{label}</p>
      {messages.map((message, index) => (
        <p key={index} className="type-body-m wrap-break-word text-text-primary">
          {message}
        </p>
      ))}
    </div>
  );
}

/** The esqueleto of a Mensagem da BlindPay, its label and one line (Esqueleto mensagem, 520:10688). */
export function BlindPayMessageSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("rounded-md", className)}>
      <div className="invisible flex flex-col gap-2 p-4">
        <span className="type-label-s">.</span>
        <span className="type-body-m">.</span>
      </div>
    </Skeleton>
  );
}

/** The wait of an approved verification (Liberando, Conta a caminho): the spinner and the line. */
function ProgressLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 type-body-m text-text-secondary">
      <LoaderCircle
        aria-hidden
        className="size-icon-md shrink-0 text-icon-accent motion-safe:animate-spin"
      />
      {children}
    </p>
  );
}

type RefusalReasons =
  { status: "loading" } | { status: "failed" } | { status: "loaded"; messages: string[] };

/** The reasons of the refusal, read live from BlindPay and never kept (SPEC-015 P3, R4). */
function useRefusalReasons(): { reasons: RefusalReasons; retry: () => void } {
  const { getToken } = useSession();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [reasons, setReasons] = useState<RefusalReasons>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReasons({ status: "loading" });
    void (async () => {
      try {
        const attempt = await getCustomerAttempt(await tokenRef.current());
        if (!cancelled) {
          const messages = attempt.reasons
            .map((reason) => reason.message)
            .filter((message) => message.trim() !== "");
          setReasons({ status: "loaded", messages });
        }
      } catch {
        if (!cancelled) {
          setReasons({ status: "failed" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { reasons, retry: () => setAttempt((value) => value + 1) };
}

/**
 * Figma: Recebimento · Recusado (301:4010, 302:4856), Vários motivos (499:4574, 501:5276), Sem
 * motivo (520:11627, 520:11765) and Falha ao carregar o motivo (520:11888, 520:12063). A failure
 * to read the reasons still lets the producer correct and send again, through the terms (R2).
 */
function RejectedCard() {
  const flow = useReceiving();
  const { reasons, retry } = useRefusalReasons();
  let detail: ReactNode = null;
  if (reasons.status === "loading") {
    detail = <BlindPayMessageSkeleton />;
  } else if (reasons.status === "failed") {
    detail = (
      <Alert
        tone="warning"
        action={
          <Button variant="ghost" size="s" onClick={retry}>
            Tentar de novo
          </Button>
        }
      >
        <AlertTitle>Não deu para carregar o motivo</AlertTitle>
        <AlertDescription>Você ainda pode corrigir e enviar de novo.</AlertDescription>
      </Alert>
    );
  } else if (reasons.messages.length > 0) {
    detail = (
      <BlindPayMessage label="Detalhe informado pela BlindPay" messages={reasons.messages} />
    );
  }
  return (
    <StepCard
      status={<Status status="rejected" size="m" />}
      title="A verificação foi recusada"
      description="Confira seus dados e documentos e envie de novo. A nova verificação começa pelos termos e traz preenchidos os dados que você já informou."
      action={
        <Button
          variant="inverse"
          size="l"
          className="w-full md:w-auto"
          onClick={() => flow.go(stepHref("terms"))}
        >
          Corrigir e enviar de novo
        </Button>
      }
    >
      {detail}
    </StepCard>
  );
}

/** The cards of the results without a request open (§6 "Resultados"). */
function ResultCard({ result }: { result: Exclude<Result, "rfi"> }) {
  switch (result) {
    case "in_review":
      // Figma: Recebimento · Em análise (301:3623, 302:4594).
      return (
        <StepCard
          status={<Status status="in_review" size="m" />}
          title="Seus dados estão em análise"
          description="A BlindPay costuma responder em poucos minutos, mas pode levar até 1 dia útil. O resultado aparece aqui."
          action={<CreateEventAction />}
        >
          <MeanwhileBox />
        </StepCard>
      );
    case "rfi_answered":
      // Figma: Pendência · Respondida (499:4447, 501:5183).
      return (
        <StepCard
          status={<Status status="in_review" size="m" />}
          title="Resposta enviada"
          description="A BlindPay analisa a sua resposta, o que pode levar até 1 dia útil. O resultado aparece aqui."
          action={<CreateEventAction />}
        >
          <MeanwhileBox />
        </StepCard>
      );
    case "rfi_expired":
      // Figma: Pendência · Prazo encerrado (520:11360, 520:11501).
      return (
        <StepCard
          status={<Status status="pending" size="m" />}
          title="O prazo para responder terminou"
          description="A BlindPay vai concluir a verificação sem a resposta. O resultado aparece aqui."
          action={<CreateEventAction />}
        >
          <MeanwhileBox />
        </StepCard>
      );
    case "rejected":
      return <RejectedCard />;
    case "releasing":
      // Figma: Recebimento · Liberando (301:4205, 302:4981); its failure is the notice above.
      return (
        <StepCard
          status={<Status status="approved" size="m" />}
          title="Verificação aprovada"
          description="Estamos ligando sua conta de recebimento à BlindPay. Leva alguns segundos."
        >
          <ProgressLine>Liberando o recebimento…</ProgressLine>
        </StepCard>
      );
    case "account_on_way":
      // Figma: Aprovada · Conta a caminho (498:4248, 501:5385); the resume finishes it (R6).
      return (
        <StepCard
          status={<Status status="approved" size="m" />}
          title="Verificação aprovada"
          description="Estamos terminando sua conta de recebimento. Leva alguns segundos."
        >
          <ProgressLine>Preparando a conta de recebimento…</ProgressLine>
        </StepCard>
      );
    case "ready":
      // Figma: Recebimento · Pronto (301:4372, 302:5084).
      return (
        <StepCard
          status={<Status status="approved" size="m" />}
          title="Tudo pronto para vender"
          description="Sua conta de recebimento está ativa e a verificação foi aprovada. O dinheiro das vendas cai direto nela."
          action={<CreateEventAction />}
        />
      );
  }
}

/**
 * Figma: Recebimento · Pendência (545:10102), the phone's root with a request open: the deadline
 * and "Responder", which opens the questions; Carregando (520:10861) and Falha ao carregar
 * (520:11193). On the desktop the root shows the first question instead.
 */
function RfiRootCard() {
  const { producer } = useProducer();
  const flow = useReceiving();
  const { read, reload } = useRfi();
  const rfi = read.status === "loaded" ? read.rfi : null;
  return (
    <section aria-labelledby="rfi-root-title" className={stepCardClassName}>
      <div className="flex flex-col gap-2">
        <Status status="pending" size="m" />
        <h2 id="rfi-root-title" className="type-heading-h3 text-text-primary">
          A BlindPay pediu mais informações
        </h2>
        {read.status === "loading" ? (
          <Skeleton className="w-full rounded-sm">
            <span className="invisible block type-body-m">.</span>
          </Skeleton>
        ) : rfi === null ? null : (
          <p className="type-body-m text-text-secondary">
            Responda até {formatDayMonth(rfi.expiresAt)}. {rfiConsequence(producer)}
          </p>
        )}
      </div>
      {read.status === "failed" ? (
        <Alert
          tone="danger"
          action={
            <Button variant="ghost" size="s" onClick={reload}>
              Tentar de novo
            </Button>
          }
        >
          <AlertTitle>Não deu para carregar o pedido</AlertTitle>
          <AlertDescription>Confira sua conexão e tente de novo.</AlertDescription>
        </Alert>
      ) : null}
      <StepCardActions
        action={
          <Button
            variant="inverse"
            size="l"
            className="w-full md:w-auto"
            disabled={rfi === null}
            onClick={() => flow.go(rfiHref())}
          >
            Responder
          </Button>
        }
      />
    </section>
  );
}

/**
 * The results of the verification at `/producer/receiving` (SPEC-015 §6 "Resultados", §5.2): on
 * the phone the tab's root, with the card and the Etapas below it; on the desktop the Etapas
 * beside the card. The notice of the receiving account goes above. With a request for information
 * open, this is the phone's part; the desktop shows its first question (the root's RfiScreen).
 */
export function ReceivingResult() {
  const result = useReceivingResult();
  const steps = useResultSteps(result);
  const header = (
    <>
      <div className="md:hidden">
        <PageHeader title="Recebimento" description="Para onde vai o dinheiro das vendas" />
      </div>
      <ReceivingHeader />
    </>
  );

  if (result === "rfi") {
    return (
      <div className="flex flex-col gap-5 md:hidden">
        {header}
        <ReceivingAccountNotice />
        <RfiRootCard />
        <StepsCard items={steps} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {header}
      <ReceivingAccountNotice />
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        <StepsCard
          items={steps}
          className="order-2 md:order-none md:w-dashboard-aside md:shrink-0"
        />
        <div className="order-1 flex min-w-0 flex-col md:order-none md:flex-1">
          <ResultCard result={result} />
        </div>
      </div>
    </div>
  );
}
