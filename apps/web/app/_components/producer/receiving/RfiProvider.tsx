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
  getOpenRfi,
  type OpenRfi,
  submitRfi,
  uploadOnboardingFile,
} from "../../../_lib/api/onboarding";
import { PRODUCER_POLL_MS } from "../../../_lib/producer/gate";
import { fileFingerprint, keyFor, type RequestKey } from "../../../_lib/producer/idempotency";
import { prepareOnboardingFile } from "../../../_lib/producer/onboarding-files";
import type { SentFile } from "../../../_lib/producer/receiving-data";
import {
  fileProblemFromCheck,
  fileProblemFromUpload,
  fileProblemMessage,
  rfiSubmissionProblem,
} from "../../../_lib/producer/receiving-errors";
import { receivingRoot } from "../../../_lib/producer/receiving-flow";
import { type RfiRead, rfiOpen } from "../../../_lib/producer/receiving-result";
import {
  emptyRfiDraft,
  rfiAnswersBody,
  type RfiDraft,
  rfiHref,
  rfiPassoOf,
  type RfiProblem,
  rfiSectionProblems,
} from "../../../_lib/producer/rfi";
import { useSession } from "../../../_lib/session";
import { useProducer } from "../ProducerContext";
import type { FileRow } from "./ReceivingProvider";

export type RfiErrors = Readonly<Partial<Record<string, RfiProblem>>>;

interface RfiContextValue {
  /** The request as read for the producer, and the one answered from this page. */
  read: RfiRead;
  /** Reads the request again: "Tentar de novo" of Pendência · Falha ao carregar. */
  reload: () => void;
  draft: RfiDraft;
  setValue: (key: string, value: string) => void;
  /** The Envio de arquivo of each file field, by key; absent while empty. */
  rows: Readonly<Partial<Record<string, FileRow>>>;
  /** Checks a file chosen for a field and sends it to BlindPay through the API. */
  chooseFile: (key: string, file: File) => void;
  errors: RfiErrors;
  /** Sets or (with null) clears the errors of these fields. */
  setErrors: (errors: Readonly<Record<string, RfiProblem | null>>) => void;
  /** Questions the producer went on from, in a row. */
  confirmed: number;
  confirm: (passo: number) => void;
  submission: { sending: boolean; failed: boolean };
  /**
   * "Enviar resposta", from the question `passo`: the whole answer at once; the same answer sends
   * the same request again. A field to correct takes the producer to its question.
   */
  submit: (passo: number) => Promise<void>;
}

const RfiContext = createContext<RfiContextValue | null>(null);

/** The request for information of the Recebimento, inside its layout. */
export function useRfi(): RfiContextValue {
  const context = useContext(RfiContext);
  if (context === null) {
    throw new Error("useRfi must be used inside the Recebimento's layout.");
  }
  return context;
}

type Loaded = Pick<RfiRead, "status" | "rfi">;

/**
 * BlindPay's request for information (SPEC-015 §6 "Campos do RFI", R10): read live while the
 * producer has one open, never stored; the answers stay in the page's memory while the questions
 * go back and forth, and go to BlindPay at once. A request answered here shows Respondida until
 * the producer leaves it, and the producer is read again meanwhile, as in the other waits (D-17).
 */
export function RfiProvider({ children }: { children: ReactNode }) {
  const { producer, reloadProducer } = useProducer();
  const { getToken } = useSession();
  const router = useRouter();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const open = rfiOpen(producer);

  const [loaded, setLoaded] = useState<Loaded>({ status: "loading", rfi: null });
  const [attempt, setAttempt] = useState(0);
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RfiDraft>(emptyRfiDraft);
  const [rows, setRows] = useState<Partial<Record<string, FileRow>>>({});
  const [errors, setErrorState] = useState<RfiErrors>({});
  const [confirmed, setConfirmed] = useState(0);
  const [submission, setSubmission] = useState({ sending: false, failed: false });
  // Not state: they change what is sent, never what is shown.
  const submissionKey = useRef<RequestKey | null>(null);
  const fileKeys = useRef<Partial<Record<string, RequestKey>>>({});
  // A newer choice for a field, or answers cleared, make an older upload's answer stale.
  const fileRuns = useRef<Partial<Record<string, number>>>({});

  const clearAnswers = useCallback(() => {
    setDraft(emptyRfiDraft);
    setRows({});
    setErrorState({});
    setConfirmed(0);
    setSubmission({ sending: false, failed: false });
    submissionKey.current = null;
    fileKeys.current = {};
    fileRuns.current = {};
  }, []);

  // Read while a request is open; leaving it (BlindPay moved the verification on) clears it all.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        setAnsweredId(null);
        clearAnswers();
      }
      return;
    }
    wasOpen.current = true;
    let cancelled = false;
    setLoaded({ status: "loading", rfi: null });
    void (async () => {
      try {
        const rfi = await getOpenRfi(await tokenRef.current());
        if (!cancelled) {
          setLoaded({ status: "loaded", rfi });
        }
      } catch {
        if (!cancelled) {
          setLoaded({ status: "failed", rfi: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt, clearAnswers]);

  // Answered, or past its deadline: BlindPay decides next, and the producer is read again.
  const waiting =
    open &&
    (answeredId !== null || loaded.rfi?.status === "submitted" || loaded.rfi?.status === "expired");
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setInterval(() => void reloadProducer(), PRODUCER_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, reloadProducer]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const setValue = useCallback((key: string, value: string) => {
    setDraft((current) => ({ ...current, values: { ...current.values, [key]: value } }));
  }, []);

  const setErrors = useCallback((updates: Readonly<Record<string, RfiProblem | null>>) => {
    setErrorState((current) => {
      const next: Partial<Record<string, RfiProblem>> = { ...current };
      for (const [key, problem] of Object.entries(updates)) {
        if (problem === null) {
          delete next[key];
        } else {
          next[key] = problem;
        }
      }
      return next;
    });
  }, []);

  const setFile = useCallback((key: string, file: SentFile | null) => {
    setDraft((current) => {
      const files = { ...current.files };
      if (file === null) {
        delete files[key];
      } else {
        files[key] = file;
      }
      return { ...current, files };
    });
  }, []);

  const chooseFile = useCallback(
    (key: string, file: File) => {
      const run = (fileRuns.current[key] ?? 0) + 1;
      fileRuns.current[key] = run;
      const current = (): boolean => fileRuns.current[key] === run;
      const fail = (message: string): void =>
        setRows((all) => ({ ...all, [key]: { state: "error", fileName: null, error: message } }));

      // The file sent before stops counting while another one is on its way.
      setFile(key, null);
      setErrors({ [key]: null });
      setRows((all) => ({ ...all, [key]: { state: "uploading", fileName: null, error: null } }));
      void (async () => {
        const checked = await prepareOnboardingFile(file, "document");
        if (!current()) {
          return;
        }
        if (checked.status === "rejected") {
          fail(fileProblemMessage(fileProblemFromCheck(checked.reason), "document"));
          return;
        }
        const request = keyFor(fileKeys.current[key], fileFingerprint(key, file));
        fileKeys.current[key] = request;
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
          setFile(key, { name, fileUrl: sent.fileUrl });
          setRows((all) => ({ ...all, [key]: { state: "sent", fileName: name, error: null } }));
        } catch (error) {
          if (current()) {
            fail(fileProblemMessage(fileProblemFromUpload(error), "document"));
          }
        }
      })();
    },
    [setFile, setErrors],
  );

  const confirm = useCallback((passo: number) => {
    setConfirmed((current) => Math.max(current, passo));
  }, []);

  const rfi: OpenRfi | null =
    loaded.status === "loaded" && loaded.rfi?.status === "pending" ? loaded.rfi : null;

  const submit = useCallback(
    async (passo: number) => {
      if (rfi === null || submission.sending) {
        return;
      }
      const show = (question: number): void => {
        if (question !== passo) {
          router.push(rfiHref(question));
        }
      };
      // Every question again: one answered before may have changed since.
      for (const [index, section] of rfi.request.entries()) {
        const problems = rfiSectionProblems(section, draft);
        if (Object.keys(problems).length > 0) {
          setErrorState((current) => ({ ...current, ...problems }));
          show(index + 1);
          return;
        }
      }
      const body = rfiAnswersBody(rfi, draft);
      // "Tentar de novo" repeats this very request; another answer makes another one.
      const request = keyFor(submissionKey.current, `${rfi.id}\u0000${JSON.stringify(body)}`);
      submissionKey.current = request;
      setSubmission({ sending: true, failed: false });
      try {
        await submitRfi(await tokenRef.current(), body, request.key);
      } catch (error) {
        const problem = rfiSubmissionProblem(error);
        const question = problem.kind === "field" ? rfiPassoOf(rfi, problem.field) : null;
        if (problem.kind === "field" && question !== null) {
          setSubmission({ sending: false, failed: false });
          setErrorState((current) => ({ ...current, [problem.field]: "format" }));
          show(question);
        } else if (problem.kind === "gone") {
          // No longer open (answered elsewhere, past the deadline): the root shows what it is now.
          clearAnswers();
          setAttempt((value) => value + 1);
          router.replace(receivingRoot);
        } else {
          setSubmission({ sending: false, failed: true });
        }
        return;
      }
      // Answered: nothing typed stays in the page, and BlindPay's decision comes with the producer.
      setAnsweredId(rfi.id);
      clearAnswers();
      router.replace(receivingRoot);
      void reloadProducer();
    },
    [rfi, submission.sending, draft, router, clearAnswers, reloadProducer],
  );

  const value = useMemo<RfiContextValue>(
    () => ({
      read: { ...loaded, answeredId },
      reload,
      draft,
      setValue,
      rows,
      chooseFile,
      errors,
      setErrors,
      confirmed,
      confirm,
      submission,
      submit,
    }),
    [
      loaded,
      answeredId,
      reload,
      draft,
      setValue,
      rows,
      chooseFile,
      errors,
      setErrors,
      confirmed,
      confirm,
      submission,
      submit,
    ],
  );

  return <RfiContext.Provider value={value}>{children}</RfiContext.Provider>;
}
