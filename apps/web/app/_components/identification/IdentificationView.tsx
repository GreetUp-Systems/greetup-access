"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@access/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@access/ui/components/field";
import { Input } from "@access/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@access/ui/components/input-otp";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@access/ui/components/item";
import { TopBar } from "@access/ui/components/top-bar";
import { Ticket, X } from "lucide-react";
import { type FormEvent, useRef } from "react";

import { type BootstrapOrigin } from "../../_lib/api/account";
import { CODE_LENGTH, formatCountdown } from "../../_lib/identification";

export type IdentificationStep = "email" | "code";

export interface IdentificationViewProps {
  origin: BootstrapOrigin;
  /** Figma: Resumo, the order being bought; only in the checkout. */
  summary?: { title: string; subtitle: string } | undefined;
  step: IdentificationStep;
  email: string;
  onEmailChange: (value: string) => void;
  emailError?: string | undefined;
  code: string;
  onCodeChange: (value: string) => void;
  codeError?: string | undefined;
  /** Figma: Falha na identificação, the error toast. */
  failed: boolean;
  busy: boolean;
  /** Time left before the code can be resent; 0 shows "Reenviar o código". */
  resendInMs: number;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
  onClose: () => void;
}

// Texts from the Figma screens (SPEC-014 §5 and §6).
const copy = {
  checkout: {
    bar: "Identificação",
    title: "Qual é o seu e-mail?",
    text: "Enviaremos um código para confirmar. Seus ingressos ficam salvos nessa conta.",
  },
  login: {
    bar: "Entrar",
    title: "Entre no Access",
    text: "Digite seu e-mail e enviaremos um código para entrar. Sem senha.",
  },
} as const;

/**
 * E-mail, then the 6-digit code (Identificação 145:1422, 145:1506, 148:1945, 148:2183; Entrar
 * 176:2292, 176:5744; states 188:2785, 190:2901, 190:2973 and their desktop pairs). Below md the
 * dialog is a full screen with the top bar, the toast and the order summary come before the
 * heading, and the action sits at the bottom; from md it is the window with the close button.
 */
export function IdentificationView(props: IdentificationViewProps) {
  const { origin, summary, step, email, failed, busy, resendInMs } = props;
  const emailRef = useRef<HTMLInputElement>(null);
  const texts = copy[origin];

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // The e-mail field, not the top bar's back button, gets the focus.
          event.preventDefault();
          emailRef.current?.focus();
        }}
      >
        <TopBar className="md:hidden" type="navigation" title={texts.bar} onBack={props.onBack} />
        <form
          className="flex flex-1 flex-col gap-6 px-4 pt-5 pb-3 md:p-0"
          onSubmit={submit}
          noValidate
        >
          <div className="flex items-start justify-between gap-6">
            <DialogHeader>
              <DialogTitle>{step === "email" ? texts.title : "Digite o código"}</DialogTitle>
              <DialogDescription>
                {step === "email" ? texts.text : `Enviamos 6 dígitos para ${email.trim()}.`}
              </DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button
                className="hidden md:inline-flex"
                variant="ghost"
                size="icon-m"
                aria-label="Fechar"
              >
                <X />
              </Button>
            </DialogClose>
          </div>

          {failed ? (
            <Alert className="-order-2 md:order-none" tone="danger">
              <AlertTitle>Não deu para continuar</AlertTitle>
              <AlertDescription>
                O serviço de login não respondeu. Confira a internet e tente de novo.
              </AlertDescription>
            </Alert>
          ) : null}

          {summary !== undefined ? (
            <div className="-order-1 rounded-lg border border-border-subtle bg-bg-surface md:order-none md:border-0 md:bg-bg-subtle">
              <Item size="compact">
                <ItemMedia>
                  <Ticket />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{summary.title}</ItemTitle>
                  <ItemDescription>{summary.subtitle}</ItemDescription>
                </ItemContent>
              </Item>
            </div>
          ) : null}

          {step === "email" ? (
            <Field disabled={busy}>
              <FieldLabel htmlFor="identification-email">E-mail</FieldLabel>
              <Input
                ref={emailRef}
                id="identification-email"
                size="l"
                type="email"
                name="email"
                placeholder="voce@email.com"
                autoComplete="email"
                value={email}
                onChange={(event) => props.onEmailChange(event.target.value)}
                aria-invalid={props.emailError !== undefined || undefined}
                aria-describedby={
                  props.emailError !== undefined ? "identification-email-error" : undefined
                }
                disabled={busy}
              />
              {props.emailError !== undefined ? (
                <FieldError id="identification-email-error">{props.emailError}</FieldError>
              ) : null}
            </Field>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <InputOTP
                  maxLength={CODE_LENGTH}
                  value={props.code}
                  onChange={props.onCodeChange}
                  inputMode="numeric"
                  pattern="^\d*$"
                  autoFocus
                  aria-label="Código de 6 dígitos"
                  aria-invalid={props.codeError !== undefined || undefined}
                  aria-describedby={
                    props.codeError !== undefined ? "identification-code-error" : undefined
                  }
                  disabled={busy}
                >
                  <InputOTPGroup className="md:gap-4">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        aria-invalid={props.codeError !== undefined || undefined}
                        className="md:aspect-14/17 md:bg-bg-subtle"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {props.codeError !== undefined ? (
                  <FieldError id="identification-code-error">{props.codeError}</FieldError>
                ) : null}
              </div>
              <div className="flex justify-center">
                {resendInMs > 0 ? (
                  <p className="type-body-m text-text-secondary">
                    Reenviar o código em {formatCountdown(resendInMs)}
                  </p>
                ) : (
                  <Button variant="ghost" size="s" onClick={props.onResend} disabled={busy}>
                    Reenviar o código
                  </Button>
                )}
              </div>
            </>
          )}

          <Button
            className="mt-auto w-full md:mt-0"
            type="submit"
            variant="inverse"
            size="l"
            loading={busy}
            disabled={step === "code" && props.code.length !== CODE_LENGTH}
          >
            {step === "email" ? "Enviar código" : "Confirmar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
