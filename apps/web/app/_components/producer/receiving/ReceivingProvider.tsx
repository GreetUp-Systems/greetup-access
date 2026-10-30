"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createCustomer,
  getCustomerAttempt,
  type IdDocumentType,
  uploadOnboardingFile,
} from "../../../_lib/api/onboarding";
import type { KycStatus } from "../../../_lib/api/producer";
import type { CepAddress } from "../../../_lib/producer/cep";
import { fileFingerprint, keyFor, type RequestKey } from "../../../_lib/producer/idempotency";
import { prepareOnboardingFile } from "../../../_lib/producer/onboarding-files";
import {
  type AddressFields,
  customerInput,
  dataPassosDone,
  type DocumentSlot,
  emptyForm,
  formFromDraft,
  type PersonalFields,
  type ReceivingForm,
  type SentFile,
} from "../../../_lib/producer/receiving-data";
import {
  fileProblemFromCheck,
  fileProblemFromUpload,
  fileProblemMessage,
  type SubmissionProblem,
  submissionProblem,
} from "../../../_lib/producer/receiving-errors";
import {
  type ReceivingProgress,
  receivingRoot,
  type ReceivingStage,
  receivingStage,
} from "../../../_lib/producer/receiving-flow";
import {
  clearAcceptedTerms,
  readAcceptedTerms,
  storeAcceptedTerms,
} from "../../../_lib/producer/terms";
import { useSession } from "../../../_lib/session";
import { useProducer } from "../ProducerContext";

/** One file row of Documentos (Envio de arquivo): its state, the name sent or the error. */
export interface FileRow {
  state: "empty" | "uploading" | "sent" | "error";
  fileName: string | null;
  error: string | null;
}

const emptyRow: FileRow = { state: "empty", fileName: null, error: null };
const emptyRows: Record<DocumentSlot, FileRow> = {
  front: emptyRow,
  back: emptyRow,
  selfie: emptyRow,
};

/** The previous attempt's data for a new one (R2): not asked, on its way, filled, or unavailable. */
export type DraftState = "none" | "loading" | "loaded" | "failed";

/** What ViaCEP said about the CEP typed, kept while the producer goes back and forth. */
export type CepState = "none" | "found" | "not_found";

export interface Submission {
  sending: boolean;
  problem: SubmissionProblem | null;
}

interface ReceivingContextValue {
  stage: ReceivingStage;
  progress: ReceivingProgress;
  form: ReceivingForm;
  /** The producer went on from this passo of Seus dados, which now counts as done. */
  confirmData: (passo: number) => void;
  setPersonal: (field: keyof PersonalFields, value: string) => void;
  setPhone: (value: string) => void;
  setAddress: (fields: Partial<AddressFields>) => void;
  /** Fills the address from ViaCEP: the street when it has one, the city and the UF. */
  fillAddress: (address: CepAddress) => void;
  /** The street, number, city and UF are on the screen (after the CEP, or from the draft). */
  addressOpen: boolean;
  openAddress: () => void;
  cep: CepState;
  setCep: (state: CepState) => void;
  draft: DraftState;
  documentType: IdDocumentType | null;
  chooseDocument: (type: IdDocumentType) => void;
  rows: Record<DocumentSlot, FileRow>;
  /** Checks the file chosen for a row and sends it to BlindPay through the API. */
  chooseFile: (slot: DocumentSlot, file: File) => void;
  /** Termos · Sem aceite: the producer came back from BlindPay without accepting. */
  termsNotAccepted: boolean;
  setTermsNotAccepted: (value: boolean) => void;
  acceptTerms: (tosId: string) => void;
  submission: Submission;
  /** "Enviar para verificação"; the same data and files send the same request again. */
  submit: () => Promise<void>;
  clearSubmissionProblem: () => void;
  /** Goes forward in the flow, as a new history entry. */
  go: (href: string) => void;
  /** Notes a link of the flow that goes forward (the link navigates by itself). */
  reachForward: (href: string) => void;
  /**
   * Goes back one passo: to where the flow came from when it got here, or else to `fallback`, in
   * place of this entry (the page opened straight at this address).
   */
  back: (current: string, fallback: string) => void;
}

const ReceivingContext = createContext<ReceivingContextValue | null>(null);

/** The Recebimento's configuration, inside its layout. */
export function useReceiving(): ReceivingContextValue {
  const context = useContext(ReceivingContext);
  if (context === null) {
    throw new Error("useReceiving must be used inside the Recebimento's layout.");
  }
  return context;
}

const isEmptyForm = (form: ReceivingForm): boolean =>
  JSON.stringify(form) === JSON.stringify(emptyForm);

/**
 * The configuration of the Recebimento (SPEC-015 §6, R2, R10), kept in the memory of the page at
 * the Recebimento's layout, so the passos share it and the browser's back never loses what was
 * typed. Only the accepted terms go to the tab's storage, to survive BlindPay's page. A reload
 * starts over; the submission empties it.
 */
export function ReceivingProvider({ children }: { children: ReactNode }) {
  const { producer, reloadProducer } = useProducer();
  const { getToken } = useSession();
  const router = useRouter();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const producerId = producer.id;
  const status = producer.compliance.status;

  const [tosId, setTosId] = useState<string | null>(() => readAcceptedTerms(producerId));
  const [termsNotAccepted, setTermsNotAccepted] = useState(false);
  const [form, setForm] = useState<ReceivingForm>(emptyForm);
  // The last passo of Seus dados the producer went on from with "Continuar".
  const [dataConfirmed, setDataConfirmed] = useState(0);
  const [addressOpen, setAddressOpen] = useState(false);
  const [cep, setCep] = useState<CepState>("none");
  const [draft, setDraft] = useState<DraftState>("none");
  const [documentType, setDocumentType] = useState<IdDocumentType | null>(null);
  const [files, setFiles] = useState<Partial<Record<DocumentSlot, SentFile>>>({});
  const [rows, setRows] = useState<Record<DocumentSlot, FileRow>>(emptyRows);
  const [submission, setSubmission] = useState<Submission>({ sending: false, problem: null });
  const [submittedFrom, setSubmittedFrom] = useState<{ status: KycStatus | null } | null>(null);
  // Not state: they change what is sent, never what is shown.
  const submissionKey = useRef<RequestKey | null>(null);
  const fileKeys = useRef<Partial<Record<DocumentSlot, RequestKey>>>({});
  // A newer choice for a row (or another document) makes an older upload's answer stale.
  const rowRuns = useRef<Record<DocumentSlot, number>>({ front: 0, back: 0, selfie: 0 });
  // The addresses reached going forward in the flow, for "Voltar" to step back in history.
  const reachedForward = useRef(new Set<string>());

  // A verification sent elsewhere (another tab, a retried request) used the acceptance.
  useEffect(() => {
    if (status !== null && status !== "rejected") {
      clearAcceptedTerms(producerId);
      setTosId(null);
    }
  }, [status, producerId]);

  const termsAccepted = tosId !== null;
  const stage = useMemo(
    () => receivingStage(producer, { termsAccepted, submittedFrom }),
    [producer, termsAccepted, submittedFrom],
  );

  // The new attempt opens Seus dados with the refused attempt's data, read once (R2).
  const draftAsked = useRef(false);
  const wantsDraft = stage.configuring && stage.retry && draft === "none";
  useEffect(() => {
    if (!wantsDraft || draftAsked.current) {
      return;
    }
    draftAsked.current = true;
    setDraft("loading");
    void (async () => {
      try {
        const attempt = await getCustomerAttempt(await tokenRef.current());
        const drafted = formFromDraft(attempt.draft);
        // Never over what the producer already typed.
        setForm((current) => (isEmptyForm(current) ? drafted.form : current));
        if (drafted.form.address.street !== "" || drafted.form.address.city !== "") {
          setAddressOpen(true);
        }
        setDocumentType((current) => current ?? drafted.documentType);
        setDraft("loaded");
      } catch {
        setDraft("failed");
      }
    })();
  }, [wantsDraft]);

  const progress = useMemo<ReceivingProgress>(
    () => ({
      termsAccepted,
      // A passo counts once it is right and the producer went on from it: the previous attempt's
      // data comes back filled, but the new attempt still goes through each passo (R2).
      dataDone: Math.min(dataPassosDone(form), dataConfirmed),
      documentType,
      sent: {
        front: files.front !== undefined,
        back: files.back !== undefined,
        selfie: files.selfie !== undefined,
      },
    }),
    [termsAccepted, form, dataConfirmed, documentType, files],
  );

  const confirmData = useCallback((passo: number) => {
    setDataConfirmed((current) => Math.max(current, passo));
  }, []);

  const setPersonal = useCallback((field: keyof PersonalFields, value: string) => {
    setForm((current) => ({ ...current, personal: { ...current.personal, [field]: value } }));
  }, []);
  const setPhone = useCallback((phone: string) => {
    setForm((current) => ({ ...current, phone }));
  }, []);
  const setAddress = useCallback((fields: Partial<AddressFields>) => {
    setForm((current) => ({ ...current, address: { ...current.address, ...fields } }));
  }, []);
  const fillAddress = useCallback((found: CepAddress) => {
    setForm((current) => ({
      ...current,
      address: {
        ...current.address,
        street: found.street ?? current.address.street,
        city: found.city,
        uf: found.uf,
      },
    }));
  }, []);
  const openAddress = useCallback(() => setAddressOpen(true), []);

  const chooseDocument = useCallback(
    (type: IdDocumentType) => {
      if (type === documentType) {
        return;
      }
      setDocumentType(type);
      // The sides belong to the document: another one asks for them again; the selfie stays.
      rowRuns.current.front += 1;
      rowRuns.current.back += 1;
      setFiles((current) => (current.selfie === undefined ? {} : { selfie: current.selfie }));
      setRows((current) => ({ ...current, front: emptyRow, back: emptyRow }));
    },
    [documentType],
  );

  const chooseFile = useCallback((slot: DocumentSlot, file: File) => {
    const run = rowRuns.current[slot] + 1;
    rowRuns.current[slot] = run;
    const current = (): boolean => rowRuns.current[slot] === run;
    const kind = slot === "selfie" ? "selfie" : "document";
    const fail = (message: string): void =>
      setRows((all) => ({ ...all, [slot]: { state: "error", fileName: null, error: message } }));

    // The file sent before stops counting while another one is on its way.
    setFiles((all) => {
      const next = { ...all };
      delete next[slot];
      return next;
    });
    setRows((all) => ({ ...all, [slot]: { state: "uploading", fileName: null, error: null } }));
    void (async () => {
      const checked = await prepareOnboardingFile(file, kind);
      if (!current()) {
        return;
      }
      if (checked.status === "rejected") {
        fail(fileProblemMessage(fileProblemFromCheck(checked.reason), kind));
        return;
      }
      const request = keyFor(fileKeys.current[slot], fileFingerprint(slot, file));
      fileKeys.current[slot] = request;
      try {
        const sent = await uploadOnboardingFile(
          await tokenRef.current(),
          checked.file,
          request.key,
        );
        if (!current()) {
          return;
        }
        const name = checked.file.name;
        setFiles((all) => ({ ...all, [slot]: { name, fileUrl: sent.fileUrl } }));
        setRows((all) => ({ ...all, [slot]: { state: "sent", fileName: name, error: null } }));
      } catch (error) {
        if (current()) {
          fail(fileProblemMessage(fileProblemFromUpload(error), kind));
        }
      }
    })();
  }, []);

  const acceptTerms = useCallback(
    (id: string) => {
      storeAcceptedTerms(producerId, id);
      setTosId(id);
      setTermsNotAccepted(false);
    },
    [producerId],
  );

  const reachForward = useCallback((href: string) => {
    reachedForward.current.add(href);
  }, []);

  const go = useCallback(
    (href: string) => {
      reachedForward.current.add(href);
      router.push(href);
    },
    [router],
  );

  const back = useCallback(
    (current: string, fallback: string) => {
      if (reachedForward.current.has(current)) {
        router.back();
      } else {
        router.replace(fallback);
      }
    },
    [router],
  );

  const submit = useCallback(async () => {
    if (tosId === null || documentType === null) {
      return;
    }
    const input = customerInput({ form, tosId, documentType, files });
    if (input === null) {
      return;
    }
    // "Tentar de novo" repeats this very request; other data or files make another one.
    const request = keyFor(submissionKey.current, JSON.stringify(input));
    submissionKey.current = request;
    setSubmission({ sending: true, problem: null });
    try {
      await createCustomer(await tokenRef.current(), input, request.key);
    } catch (error) {
      setSubmission({ sending: false, problem: submissionProblem(error) });
      return;
    }
    // Sent: the acceptance is used and nothing typed stays in the page.
    clearAcceptedTerms(producerId);
    setSubmittedFrom({ status });
    setTosId(null);
    setForm(emptyForm);
    setDataConfirmed(0);
    setAddressOpen(false);
    setCep("none");
    setDocumentType(null);
    setFiles({});
    setRows(emptyRows);
    submissionKey.current = null;
    fileKeys.current = {};
    setSubmission({ sending: false, problem: null });
    router.replace(receivingRoot);
    void reloadProducer();
  }, [tosId, documentType, form, files, producerId, status, router, reloadProducer]);

  const clearSubmissionProblem = useCallback(
    () => setSubmission((current) => ({ ...current, problem: null })),
    [],
  );

  const value = useMemo<ReceivingContextValue>(
    () => ({
      stage,
      progress,
      form,
      confirmData,
      setPersonal,
      setPhone,
      setAddress,
      fillAddress,
      addressOpen,
      openAddress,
      cep,
      setCep,
      draft,
      documentType,
      chooseDocument,
      rows,
      chooseFile,
      termsNotAccepted,
      setTermsNotAccepted,
      acceptTerms,
      submission,
      submit,
      clearSubmissionProblem,
      go,
      reachForward,
      back,
    }),
    [
      stage,
      progress,
      form,
      confirmData,
      setPersonal,
      setPhone,
      setAddress,
      fillAddress,
      addressOpen,
      openAddress,
      cep,
      draft,
      documentType,
      chooseDocument,
      rows,
      chooseFile,
      termsNotAccepted,
      acceptTerms,
      submission,
      submit,
      clearSubmissionProblem,
      go,
      reachForward,
      back,
    ],
  );

  return <ReceivingContext.Provider value={value}>{children}</ReceivingContext.Provider>;
}
