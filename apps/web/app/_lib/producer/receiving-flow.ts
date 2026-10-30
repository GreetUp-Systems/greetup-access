import type { IdDocumentType } from "../api/onboarding";
import type { KycStatus, ProducerProfile } from "../api/producer";
import type { SetupStepState } from "./dashboard";
import type { DocumentSlot } from "./receiving-data";

// The configuration of the Recebimento (SPEC-015 §6, R9, R10): which step and passo the producer is
// at, where an address leads, and the Etapas list. The same routes serve the phone and the desktop;
// each passo is its own history entry (?passo=N).

/** The steps the producer fills; the receiving account and the verification are not pages. */
export type ReceivingStep = "terms" | "data" | "documents";

export const receivingRoot = "/producer/receiving";

const stepPaths: Record<ReceivingStep, string> = {
  terms: "/producer/receiving/terms",
  data: "/producer/receiving/data",
  documents: "/producer/receiving/documents",
};

/** The address of a step at a passo; the first passo has no ?passo. */
export function stepHref(step: ReceivingStep, passo = 1): string {
  return passo > 1 ? `${stepPaths[step]}?passo=${passo}` : stepPaths[step];
}

/** ?passo=N as a whole number from 1; anything else is the first passo. */
export function parsePasso(value: string | null): number {
  if (value === null || !/^\d{1,2}$/.test(value)) {
    return 1;
  }
  return Math.max(1, Number(value));
}

/** Where the configuration stands for the producer's verification. */
export interface ReceivingStage {
  /**
   * The steps can be filled: the verification was never sent, or it was refused and a new attempt
   * starts at the terms (R2). Closed once sent, and right after this page sends it, until the
   * producer is read again.
   */
  open: boolean;
  /** A new attempt after a refusal. */
  retry: boolean;
  /**
   * The root shows the configuration; otherwise the result of the verification (part 3). A refused
   * producer sees the refusal until the terms are accepted again.
   */
  configuring: boolean;
}

export function receivingStage(
  producer: ProducerProfile,
  {
    termsAccepted,
    submittedFrom,
  }: {
    termsAccepted: boolean;
    /** The verification's status when this page sent it; null when it did not. */
    submittedFrom: { status: KycStatus | null } | null;
  },
): ReceivingStage {
  const status = producer.compliance.status;
  const justSent = submittedFrom !== null && submittedFrom.status === status;
  const open = !justSent && (status === null || status === "rejected");
  const retry = status === "rejected";
  return { open, retry, configuring: open && (!retry || termsAccepted) };
}

/** Where the producer is in the configuration, from the page's memory. */
export interface ReceivingProgress {
  termsAccepted: boolean;
  /** Passos of Seus dados done in a row, 0 to 3. */
  dataDone: number;
  documentType: IdDocumentType | null;
  /** The files already sent to BlindPay. */
  sent: Record<DocumentSlot, boolean>;
}

/** The first step still to do: the terms, then Seus dados, then Documentos. */
export function currentStep(progress: ReceivingProgress): ReceivingStep {
  if (!progress.termsAccepted) {
    return "terms";
  }
  return progress.dataDone < 3 ? "data" : "documents";
}

/** A passo of Documentos: one screen per item (R10). */
export type DocumentsPasso = "choose" | "front" | "back" | "selfie" | "review";

/** RG and CNH: choose, front, back, selfie and review; the passport has no back. */
export function documentsPassos(type: IdDocumentType | null): readonly DocumentsPasso[] {
  return type === "PASSPORT"
    ? ["choose", "front", "selfie", "review"]
    : ["choose", "front", "back", "selfie", "review"];
}

/** How many passos of Documentos are done in a row; the review is done only by the submission. */
export function documentsPassosDone(progress: ReceivingProgress): number {
  const passos = documentsPassos(progress.documentType);
  let done = 0;
  for (const passo of passos) {
    const finished =
      passo === "choose"
        ? progress.documentType !== null
        : passo !== "review" && progress.sent[passo];
    if (!finished) {
      break;
    }
    done += 1;
  }
  return done;
}

export type ResolvedRoute =
  { kind: "show"; step: ReceivingStep; passo: number } | { kind: "redirect"; href: string };

/**
 * The passo an address shows, or where it leads instead (SPEC-015 §6): after the submission, to the
 * root; a step or passo not yet open, to the first pending one. The terms stay open while the steps
 * are, to be accepted again (a refused producer starts the new attempt there).
 */
export function resolveRoute(
  stage: ReceivingStage,
  progress: ReceivingProgress,
  step: ReceivingStep,
  passo: number,
): ResolvedRoute {
  const show: ResolvedRoute = { kind: "show", step, passo };
  if (!stage.open) {
    return { kind: "redirect", href: receivingRoot };
  }
  if (step === "terms") {
    return passo === 1 ? show : { kind: "redirect", href: stepHref("terms") };
  }
  if (!progress.termsAccepted) {
    return { kind: "redirect", href: stepHref("terms") };
  }
  const firstData = Math.min(progress.dataDone + 1, 3);
  if (step === "data") {
    return passo <= firstData ? show : { kind: "redirect", href: stepHref("data", firstData) };
  }
  if (progress.dataDone < 3) {
    return { kind: "redirect", href: stepHref("data", firstData) };
  }
  const total = documentsPassos(progress.documentType).length;
  const firstDocuments = Math.min(documentsPassosDone(progress) + 1, total);
  return passo <= firstDocuments
    ? show
    : { kind: "redirect", href: stepHref("documents", firstDocuments) };
}

/** The steps are five, the receiving account and the verification included (R9). */
export const STEP_COUNT = 5;

/** "Etapa N de 5" and the short name beside it, on the phone. */
export const stepPosition: Record<ReceivingStep, { number: number; name: string }> = {
  terms: { number: 2, name: "Termos" },
  data: { number: 3, name: "Seus dados" },
  documents: { number: 4, name: "Documentos" },
};

export interface ReceivingStepItem {
  key: "account" | "terms" | "data" | "documents" | "verification";
  title: string;
  state: SetupStepState;
  detail: string;
}

/**
 * The Etapas list of the configuration (Figma 501:5529, 301:2818, 550:15088, 547:10491): the
 * receiving account follows the network; the step on the screen is the current one, with `detail`
 * ("Agora", or the passo on the desktop, "1 de 3"); the steps before it are done. A new attempt says
 * what comes back and what is sent again.
 */
export function receivingSteps(
  producer: ProducerProfile,
  progress: ReceivingProgress,
  { shown, detail, retry }: { shown: ReceivingStep; detail: string; retry: boolean },
): ReceivingStepItem[] {
  const stellar = producer.stellar.status;
  const account: ReceivingStepItem =
    stellar === "active"
      ? { key: "account", title: "Conta de recebimento", state: "done", detail: "Pronta" }
      : stellar === "failed"
        ? {
            key: "account",
            title: "Conta de recebimento",
            state: "error",
            detail: "Não deu para preparar",
          }
        : {
            key: "account",
            title: "Conta de recebimento",
            state: "in_progress",
            detail: "Preparando…",
          };
  const terms: ReceivingStepItem =
    shown === "terms"
      ? { key: "terms", title: "Termos da BlindPay", state: "current", detail }
      : { key: "terms", title: "Termos da BlindPay", state: "done", detail: "Aceitos" };
  let data: ReceivingStepItem;
  if (shown === "data") {
    data = { key: "data", title: "Seus dados", state: "current", detail };
  } else if (shown === "documents" && progress.dataDone === 3) {
    data = { key: "data", title: "Seus dados", state: "done", detail: "Preenchidos" };
  } else {
    data = {
      key: "data",
      title: "Seus dados",
      state: "pending",
      detail: retry ? "Preenchidos da última vez" : "Nome, CPF e endereço",
    };
  }
  const documents: ReceivingStepItem =
    shown === "documents"
      ? { key: "documents", title: "Documentos", state: "current", detail }
      : {
          key: "documents",
          title: "Documentos",
          state: "pending",
          detail: retry ? "Enviar de novo" : "Documento com foto e selfie",
        };
  const verification: ReceivingStepItem = {
    key: "verification",
    title: "Verificação",
    state: "pending",
    detail: retry ? "Nova verificação" : "Depois do envio",
  };
  return [account, terms, data, documents, verification];
}

/** The title of a file of the verification, on its screen and in its row. */
export function documentFileTitle(type: IdDocumentType, slot: DocumentSlot): string {
  if (slot === "selfie") {
    return "Selfie";
  }
  if (type === "PASSPORT") {
    return "Página com a foto";
  }
  const side = slot === "front" ? "Frente" : "Verso";
  return type === "DRIVERS" ? `${side} da CNH` : `${side} do RG`;
}
