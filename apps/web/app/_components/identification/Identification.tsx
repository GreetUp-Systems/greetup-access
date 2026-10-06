"use client";

import { useLoginWithEmail, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

import { type AccountView, type BootstrapOrigin } from "../../_lib/api/account";
import {
  classifyLoginError,
  CODE_LENGTH,
  isValidEmail,
  RESEND_INTERVAL_MS,
} from "../../_lib/identification";
import { useSession } from "../../_lib/session";
import { type IdentificationStep, IdentificationView } from "./IdentificationView";

export interface IdentificationProps {
  /** "checkout" inside a purchase, "login" from "Entrar" (SPEC-014 §7). */
  origin: BootstrapOrigin;
  summary?: { title: string; subtitle: string } | undefined;
  onClose: () => void;
  onDone: (account: AccountView) => void;
}

/** The identification flow: Privy e-mail code, then the account bootstrap (SPEC-014 §7). */
export function Identification({ origin, summary, onClose, onDone }: IdentificationProps) {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { authenticated } = usePrivy();
  const { completeLogin, abandonLogin } = useSession();

  const [step, setStep] = useState<IdentificationStep>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while the resend countdown runs.
  useEffect(() => {
    if (step !== "code" || now >= resendAt) {
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [step, now, resendAt]);

  const sendEmailCode = async (): Promise<boolean> => {
    setFailed(false);
    setBusy(true);
    try {
      await sendCode({ email: email.trim() });
      const sentAt = Date.now();
      setNow(sentAt);
      setResendAt(sentAt + RESEND_INTERVAL_MS);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (): Promise<void> => {
    if (!isValidEmail(email)) {
      setEmailError("Digite um e-mail válido.");
      return;
    }
    setEmailError(undefined);
    if (await sendEmailCode()) {
      setCode("");
      setCodeError(undefined);
      setStep("code");
    }
  };

  const submitCode = async (): Promise<void> => {
    if (code.length !== CODE_LENGTH || busy) {
      return;
    }
    setFailed(false);
    setCodeError(undefined);
    setBusy(true);
    try {
      // After a failed bootstrap Privy is already signed in: the retry only bootstraps again.
      if (!authenticated) {
        try {
          await loginWithCode({ code });
        } catch (error) {
          if (classifyLoginError(error) === "wrong_code") {
            setCodeError("Código incorreto ou expirado.");
          } else {
            setFailed(true);
          }
          return;
        }
      }
      try {
        onDone(await completeLogin(origin));
      } catch {
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Leaving after a failed bootstrap must not keep a Privy session without its account.
  const close = (): void => {
    void abandonLogin();
    onClose();
  };

  return (
    <IdentificationView
      origin={origin}
      summary={summary}
      step={step}
      email={email}
      onEmailChange={setEmail}
      emailError={emailError}
      code={code}
      onCodeChange={(value) => {
        setCode(value);
        setCodeError(undefined);
      }}
      codeError={codeError}
      failed={failed}
      busy={busy}
      resendInMs={Math.max(0, resendAt - now)}
      onSubmit={() => void (step === "email" ? submitEmail() : submitCode())}
      onResend={() => {
        setCode("");
        setCodeError(undefined);
        void sendEmailCode();
      }}
      onBack={() => {
        if (step === "code") {
          setFailed(false);
          setStep("email");
        } else {
          close();
        }
      }}
      onClose={close}
    />
  );
}
