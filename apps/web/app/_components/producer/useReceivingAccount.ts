"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ConfirmedActivation } from "../../_lib/account-activation";
import type { ProducerProfile } from "../../_lib/api/producer";
import {
  afterRun,
  initialResumeState,
  nextResume,
  type ResumeMode,
  type ResumeState,
} from "../../_lib/producer/account-resume";
import type { ProducerActivationOptions } from "../../_lib/session";

/** The receiving account's background resume, for the screens that show how it went (R6, R3). */
export interface ReceivingAccount {
  /** The resume gave up: after its last try, or at a failure that trying again will not fix. */
  stopped: boolean;
  /** The error it stopped at, to tell the Conta com erro from the Liberando · Falha. */
  error: unknown;
  /** A run is going on: "Tentar de novo" shows it while the account is prepared again. */
  running: boolean;
  /**
   * "Tentar de novo": prepares the account again and asks for the signature, a `failed` one
   * included, then goes back to resuming it (SPEC-015 R3, R6).
   */
  retry: () => void;
}

interface UseReceivingAccountOptions {
  /** The producer as last read; null while the system loads. */
  producer: ProducerProfile | null;
  /** On the Recebimento's pages, which ask for the signature. */
  onReceiving: boolean;
  activate: (options?: ProducerActivationOptions) => Promise<ConfirmedActivation>;
  /** Reads the producer again after each run. */
  reloadProducer: () => Promise<void>;
}

/**
 * The whole producer system resumes the receiving account while it is on its way (SPEC-015 R6):
 * each run goes through the session's queue (R7), and the producer is read again when it ends. The
 * count of tries starts over whenever the account moves.
 */
export function useReceivingAccount({
  producer,
  onReceiving,
  activate,
  reloadProducer,
}: UseReceivingAccountOptions): ReceivingAccount {
  const [state, setState] = useState<ResumeState>(initialResumeState);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  // A move of the account (another status) is progress: the tries start over.
  const accountKey =
    producer === null ? null : `${producer.stellar.status}:${producer.onboardingStatus}`;
  const [lastKey, setLastKey] = useState(accountKey);
  if (accountKey !== lastKey) {
    setLastKey(accountKey);
    setState(initialResumeState);
  }

  const run = useCallback(
    (mode: ResumeMode) => {
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;
      setRunning(true);
      void activate({ sign: mode === "sign" })
        .then(
          () => setState((current) => afterRun(current, { ok: true }, Date.now())),
          (error: unknown) =>
            setState((current) => afterRun(current, { ok: false, error }, Date.now())),
        )
        .then(() => reloadProducer())
        .finally(() => {
          runningRef.current = false;
          setRunning(false);
        });
    },
    [activate, reloadProducer],
  );

  const next = producer === null ? null : nextResume(producer, onReceiving, state, Date.now());
  const mode = next?.mode ?? null;
  const delayMs = next?.delayMs ?? 0;

  // Scheduled again on each render with what is left of the wait, so a re-read of the producer
  // never postpones the next try.
  useEffect(() => {
    if (mode === null || running) {
      return;
    }
    const timer = setTimeout(() => run(mode), delayMs);
    return () => clearTimeout(timer);
  }, [mode, delayMs, running, run]);

  const retry = useCallback(() => {
    setState(initialResumeState);
    run("sign");
  }, [run]);

  const { stoppedBy } = state;
  return useMemo(
    () => ({ stopped: stoppedBy !== null, error: stoppedBy?.error ?? null, running, retry }),
    [stoppedBy, running, retry],
  );
}
