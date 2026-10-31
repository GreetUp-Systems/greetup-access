"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import { Input } from "@access/ui/components/input";
import { Logo } from "@access/ui/components/logo";
import { TopBar } from "@access/ui/components/top-bar";
import { cn } from "@access/ui/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { createProducer } from "../../_lib/api/onboarding";
import { getProducer } from "../../_lib/api/producer";
import { failureRoute } from "../../_lib/producer/gate";
import { receivingRoot } from "../../_lib/producer/receiving-flow";
import { profileNameMessage, profileProblem } from "../../_lib/producer/receiving-errors";
import { useSession } from "../../_lib/session";
import { Identification } from "../identification/Identification";

const steps = ["Perfil", "Recebimento", "Evento"] as const;

/** Figma: Passos, the three steps of the start with the first one on (303:4895, 305:5827). */
function StartSteps({ className }: { className?: string }) {
  return (
    <ol aria-label="Passos" className={cn("flex items-center gap-2", className)}>
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index === 0 ? "step" : undefined}
          className={cn(
            "flex h-status-m items-center gap-1-5 rounded-full px-3 type-badge-m",
            index === 0
              ? "bg-bg-accent-subtle text-text-accent"
              : "bg-bg-subtle text-text-tertiary",
          )}
        >
          <span>{index + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Voltar ao site" goes back where the producer came from, or to the site's start. */
function goBack(router: ReturnType<typeof useRouter>): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

/**
 * Figma: Criar perfil (303:4779, 305:5771), with Nome vazio (498:3443, 519:9493) and Falha
 * (498:3500, 501:4639). The focused start of the producer (SPEC-015 N5, §6): no navigation; on the
 * desktop the logo and "Voltar ao site", on the phone the Barra superior with back. It creates the
 * profile, starts the receiving account without waiting for it and goes to the Recebimento. An
 * account that already has a profile goes to the Painel. Without a session, the identification of
 * SPEC-014 first.
 */
export function CreateProfileScreen() {
  const { state: session, getToken, logout, activateProducerAccount } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  // The profile is checked once the session is known; meanwhile "Criar perfil" waits.
  const [checked, setChecked] = useState(false);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  useEffect(() => {
    if (session.status !== "authenticated") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await getProducer(await tokenRef.current());
        if (!cancelled) {
          router.replace("/producer");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (failureRoute(error) === "sign_in") {
          void logout();
          return;
        }
        // No profile yet, or the check failed: creating it says the rest.
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.status, router, logout]);

  const create = async (): Promise<void> => {
    const displayName = name.trim();
    if (displayName === "") {
      setNameError(true);
      inputRef.current?.focus();
      return;
    }
    setFailed(false);
    setCreating(true);
    try {
      await createProducer(await getToken(), displayName);
    } catch (error) {
      setCreating(false);
      const problem = profileProblem(error);
      if (problem === "exists") {
        router.replace("/producer");
      } else if (problem === "invalid_name") {
        setNameError(true);
        inputRef.current?.focus();
      } else if (problem === "signed_out") {
        void logout();
      } else {
        setFailed(true);
      }
      return;
    }
    // The receiving account starts now and goes on in the background (SPEC-015 §6, R6).
    void activateProducerAccount().catch(() => undefined);
    router.replace(receivingRoot);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void create();
  };

  const shownName = name.trim() === "" ? "…" : name.trim();

  return (
    <div className="min-h-svh">
      <header className="hidden h-bar border-b border-border-subtle px-4 md:block">
        <div className="mx-auto flex h-full max-w-page-content items-center justify-between gap-3">
          <Logo />
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden />
              Voltar ao site
            </Link>
          </Button>
        </div>
      </header>
      <TopBar
        type="navigation"
        title="Vender ingressos"
        onBack={() => goBack(router)}
        className="md:hidden"
      />

      <main className="flex flex-col gap-4 px-4 pt-3 pb-8 md:mx-auto md:w-focus-column md:gap-6 md:px-0 md:pt-16">
        <header className="hidden flex-col gap-1 md:flex">
          <h1 className="type-heading-h1 text-text-primary">Comece a vender</h1>
          <p className="type-body-m text-text-secondary">
            Três passos e seu primeiro evento está no ar.
          </p>
        </header>

        {failed ? (
          <Alert
            tone="danger"
            action={
              <Button variant="ghost" size="s" onClick={() => void create()}>
                Tentar de novo
              </Button>
            }
          >
            <AlertTitle>Não deu para criar o perfil</AlertTitle>
            <AlertDescription>Confira sua conexão e tente de novo.</AlertDescription>
          </Alert>
        ) : null}

        <StartSteps className="md:hidden" />

        <form
          noValidate
          onSubmit={submit}
          className="flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5 md:gap-6 md:p-8"
        >
          <StartSteps className="hidden md:flex" />
          <div className="flex flex-col gap-2">
            <h2 className="type-heading-h3 text-text-primary">Crie seu perfil de produtor</h2>
            <p className="type-body-m text-text-secondary">
              É o nome que aparece para quem compra. Em seguida, preparamos sua conta de recebimento
              e você envia seus dados para a verificação.
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="producer-name">Nome do produtor</FieldLabel>
            <Input
              ref={inputRef}
              id="producer-name"
              size="l"
              value={name}
              maxLength={120}
              autoComplete="organization"
              aria-invalid={nameError || undefined}
              aria-describedby="producer-name-help"
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim() !== "") {
                  setNameError(false);
                }
              }}
            />
            {nameError ? (
              <FieldError id="producer-name-help">{profileNameMessage}</FieldError>
            ) : (
              <FieldDescription id="producer-name-help">
                Aparece como “Organizado por {shownName}” na página de cada evento.
              </FieldDescription>
            )}
          </Field>
          <Button
            type="submit"
            variant="inverse"
            size="l"
            className="w-full"
            loading={creating || !checked}
          >
            Criar perfil
          </Button>
          <p className="text-center type-body-s text-text-tertiary">
            Você usa a mesma conta para comprar e vender.
          </p>
        </form>
      </main>

      {session.status === "anonymous" ? (
        <Identification
          origin="login"
          onClose={() => router.replace("/")}
          onDone={() => undefined}
        />
      ) : null}
    </div>
  );
}
