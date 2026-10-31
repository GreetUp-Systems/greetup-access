"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { Field, FieldError, FieldLabel } from "@access/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@access/ui/components/input-group";
import { NativeSelect, NativeSelectOption } from "@access/ui/components/native-select";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { brazilianUfs, lookupCep } from "../../../_lib/producer/cep";
import { digitsOnly, maskCep, maskCpf, maskDate, maskPhone } from "../../../_lib/producer/masks";
import {
  addressComplete,
  type FieldProblem,
  fieldMessage,
  personalProblem,
  personalProblems,
  type PersonalFields,
  phoneProblem,
} from "../../../_lib/producer/receiving-data";
import { receivingRoot, receivingSteps, stepHref } from "../../../_lib/producer/receiving-flow";
import { tosIdFrom } from "../../../_lib/producer/terms";
import { useProducer } from "../ProducerContext";
import { StepCard, StepPage } from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import { ReceivingAccountNotice } from "./ReceivingResult";
import { TextField } from "./TextField";
import { useStepRoute } from "./useStepRoute";

const PASSOS = 3;

type PersonalErrors = Partial<Record<keyof PersonalFields, FieldProblem>>;

/** Seus dados · 1 Quem é você (550:13465): name, surname, CPF and birth date, as in the document. */
function WhoPasso({ onContinue }: { onContinue: () => void }) {
  const flow = useReceiving();
  const { personal } = flow.form;
  const [errors, setErrors] = useState<PersonalErrors>({});
  const refs = {
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    cpf: useRef<HTMLInputElement>(null),
    birthDate: useRef<HTMLInputElement>(null),
  };
  const loading = flow.draft === "loading";

  const change = (field: keyof PersonalFields, value: string): void => {
    flow.setPersonal(field, value);
    // A corrected field loses its error at once; a new one only shows when leaving it.
    if (errors[field] !== undefined && personalProblem(field, value) === null) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };
  const leave = (field: keyof PersonalFields): void => {
    const value = personal[field];
    if (value.trim() === "") {
      return;
    }
    const problem = personalProblem(field, value);
    setErrors((current) => ({ ...current, [field]: problem ?? undefined }));
  };
  const submit = (): void => {
    const problems = personalProblems(personal);
    setErrors(problems);
    const first = (["firstName", "lastName", "cpf", "birthDate"] as const).find(
      (field) => problems[field] !== undefined,
    );
    if (first === undefined) {
      onContinue();
    } else {
      refs[first].current?.focus();
    }
  };
  const errorOf = (field: keyof PersonalFields): string | null => {
    const problem = errors[field];
    return problem === undefined ? null : fieldMessage(field, problem);
  };

  let notice: ReactNode = null;
  if (flow.stage.retry && flow.draft === "loaded") {
    notice = (
      <Alert tone="neutral">
        <AlertTitle>Seus dados da última vez</AlertTitle>
        <AlertDescription>Confira e corrija o que precisar antes de continuar.</AlertDescription>
      </Alert>
    );
  } else if (flow.stage.retry && flow.draft === "failed") {
    notice = (
      <Alert tone="warning">
        <AlertTitle>Não deu para trazer seus dados da última vez</AlertTitle>
        <AlertDescription>Preencha de novo para continuar.</AlertDescription>
      </Alert>
    );
  }

  return (
    <StepCard
      eyebrow={`Seus dados · 1 de ${PASSOS}`}
      title="Quem é você"
      description="Use os dados do seu documento. Eles vão direto para a verificação da BlindPay; o Access não guarda uma cópia."
      descriptionOnPhone={notice === null}
      notice={notice}
      onSubmit={submit}
      action={
        <Button type="submit" variant="inverse" size="l" className="w-full md:w-auto">
          Continuar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          ref={refs.firstName}
          id="data-first-name"
          label="Nome"
          autoComplete="given-name"
          maxLength={200}
          disabled={loading}
          value={personal.firstName}
          error={errorOf("firstName")}
          onChange={(event) => change("firstName", event.target.value)}
          onBlur={() => leave("firstName")}
        />
        <TextField
          ref={refs.lastName}
          id="data-last-name"
          label="Sobrenome"
          autoComplete="family-name"
          maxLength={200}
          disabled={loading}
          value={personal.lastName}
          error={errorOf("lastName")}
          onChange={(event) => change("lastName", event.target.value)}
          onBlur={() => leave("lastName")}
        />
        <TextField
          ref={refs.cpf}
          id="data-cpf"
          label="CPF"
          className="col-span-2 md:col-span-1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          disabled={loading}
          value={personal.cpf}
          error={errorOf("cpf")}
          onChange={(event) => change("cpf", maskCpf(event.target.value))}
          onBlur={() => leave("cpf")}
        />
        <TextField
          ref={refs.birthDate}
          id="data-birth-date"
          label="Data de nascimento"
          className="col-span-2 md:col-span-1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          disabled={loading}
          value={personal.birthDate}
          error={errorOf("birthDate")}
          onChange={(event) => change("birthDate", maskDate(event.target.value))}
          onBlur={() => leave("birthDate")}
        />
      </div>
    </StepCard>
  );
}

/** Seus dados · 2 Telefone (550:14222): the phone BlindPay calls, and the account's e-mail. */
function PhonePasso({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const flow = useReceiving();
  const { email } = useProducer();
  const [problem, setProblem] = useState<FieldProblem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (): void => {
    const found = phoneProblem(flow.form.phone);
    setProblem(found);
    if (found === null) {
      onContinue();
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <StepCard
      eyebrow={`Seus dados · 2 de ${PASSOS}`}
      title="Seu telefone"
      description="A BlindPay usa para falar com você, se precisar."
      onSubmit={submit}
      onBack={onBack}
      action={
        <Button type="submit" variant="inverse" size="l" className="w-full md:w-auto">
          Continuar
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          ref={inputRef}
          id="data-phone"
          label="Telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={flow.form.phone}
          error={problem === null ? null : fieldMessage("phone", problem)}
          help={`O e-mail da sua conta também vai para a BlindPay: ${email}`}
          onChange={(event) => {
            const value = maskPhone(event.target.value);
            flow.setPhone(value);
            if (problem !== null && phoneProblem(value) === null) {
              setProblem(null);
            }
          }}
          onBlur={() => {
            if (flow.form.phone.trim() !== "") {
              setProblem(phoneProblem(flow.form.phone));
            }
          }}
        />
      </div>
    </StepCard>
  );
}

const notFoundMessage = "Não achamos esse CEP. Confira ou preencha o endereço.";

/**
 * Seus dados · 3 Endereço (550:14359 to 550:14843): the CEP first; ViaCEP fills the street, the
 * city and the state, and the producer completes the number and the complement. A CEP not found, or
 * a lookup that fails, opens the fields empty to be filled by hand.
 */
function AddressPasso({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const flow = useReceiving();
  const { address } = flow.form;
  const [looking, setLooking] = useState(false);
  const lookup = useRef<AbortController | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => lookup.current?.abort(), []);

  const search = async (cep: string): Promise<void> => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setLooking(true);
    try {
      const result = await lookupCep(cep, { signal: controller.signal });
      if (result.status === "found") {
        flow.fillAddress(result.address);
        flow.setCep("found");
        flow.openAddress();
        // The next empty field: the number, or the street of a CEP of a whole city.
        setTimeout(() => {
          (result.address.street === null ? streetRef : numberRef).current?.focus();
        }, 0);
      } else {
        flow.setCep("not_found");
        flow.openAddress();
      }
    } catch {
      // A newer CEP took its place, or the page left.
      return;
    } finally {
      if (lookup.current === controller) {
        lookup.current = null;
        setLooking(false);
      }
    }
  };

  const changeCep = (value: string): void => {
    const masked = maskCep(value);
    const digits = digitsOnly(masked);
    const changed = digits !== digitsOnly(address.cep);
    flow.setAddress({ cep: masked });
    if (!changed) {
      return;
    }
    flow.setCep("none");
    if (digits.length === 8) {
      void search(digits);
    } else {
      lookup.current?.abort();
      lookup.current = null;
      setLooking(false);
    }
  };

  const ready = addressComplete(address) && !looking;

  return (
    <StepCard
      eyebrow={`Seus dados · 3 de ${PASSOS}`}
      title="Seu endereço"
      description="Digite o CEP e o resto do endereço vem preenchido."
      descriptionOnPhone={flow.cep !== "not_found"}
      onSubmit={() => {
        if (ready) {
          onContinue();
        }
      }}
      onBack={onBack}
      action={
        <Button
          type="submit"
          variant="inverse"
          size="l"
          className="w-full md:w-auto"
          disabled={!ready}
        >
          Continuar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field className="col-span-2 md:col-span-1">
          <FieldLabel htmlFor="data-cep">CEP</FieldLabel>
          <InputGroup size="m">
            <InputGroupInput
              id="data-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={address.cep}
              aria-invalid={flow.cep === "not_found" || undefined}
              aria-describedby={flow.cep === "not_found" ? "data-cep-error" : undefined}
              aria-busy={looking || undefined}
              onChange={(event) => changeCep(event.target.value)}
            />
            {looking ? (
              <InputGroupAddon align="inline-end">
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
                <span className="sr-only">Consultando o CEP</span>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {flow.cep === "not_found" ? (
            <FieldError id="data-cep-error">{notFoundMessage}</FieldError>
          ) : null}
        </Field>
        {flow.addressOpen ? (
          <>
            <TextField
              ref={streetRef}
              id="data-street"
              label="Rua"
              className="col-span-2"
              autoComplete="address-line1"
              maxLength={150}
              value={address.street}
              onChange={(event) => flow.setAddress({ street: event.target.value })}
            />
            <TextField
              ref={numberRef}
              id="data-number"
              label="Número"
              autoComplete="off"
              maxLength={20}
              value={address.number}
              onChange={(event) => flow.setAddress({ number: event.target.value })}
            />
            <TextField
              id="data-complement"
              label="Complemento"
              autoComplete="address-line2"
              placeholder="Opcional"
              maxLength={100}
              value={address.complement}
              onChange={(event) => flow.setAddress({ complement: event.target.value })}
            />
            <TextField
              id="data-city"
              label="Cidade"
              autoComplete="address-level2"
              maxLength={100}
              value={address.city}
              onChange={(event) => flow.setAddress({ city: event.target.value })}
            />
            <Field>
              <FieldLabel htmlFor="data-uf">Estado</FieldLabel>
              <NativeSelect
                id="data-uf"
                size="m"
                autoComplete="address-level1"
                value={address.uf}
                onChange={(event) => flow.setAddress({ uf: event.target.value })}
              >
                <NativeSelectOption value="" disabled>
                  Escolha
                </NativeSelectOption>
                {brazilianUfs.map((uf) => (
                  <NativeSelectOption key={uf} value={uf}>
                    {uf}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </>
        ) : null}
      </div>
    </StepCard>
  );
}

/**
 * Figma: Seus dados in three passos (SPEC-015 R10, §6), at `/producer/receiving/data?passo=N`:
 * each Continuar is a new history entry, so the back of the browser and of the phone goes back a
 * passo with what was typed. BlindPay's terms come back here with `tos_id`, kept for the
 * submission and taken out of the address; without it, back to the terms (Sem aceite).
 */
export function DataScreen({ atRoot = false }: { atRoot?: boolean }) {
  const { producer, account } = useProducer();
  const flow = useReceiving();
  const router = useRouter();
  const params = useSearchParams();
  const incoming = atRoot ? null : tosIdFrom(params.get("tos_id"));
  const takesTerms = incoming !== null && flow.stage.open;
  const route = useStepRoute("data", atRoot, takesTerms ? true : undefined);
  const { acceptTerms, setTermsNotAccepted } = flow;

  // A `tos_id` that came after the verification was sent leads to the root with the route.
  useEffect(() => {
    if (incoming !== null && takesTerms) {
      acceptTerms(incoming);
      router.replace(stepHref("data"));
    }
  }, [incoming, takesTerms, acceptTerms, router]);

  // Back from BlindPay without the acceptance (or here without it): the terms say so.
  const toTerms = route.redirect === stepHref("terms");
  useEffect(() => {
    if (toTerms) {
      setTermsNotAccepted(true);
    }
  }, [toTerms, setTermsNotAccepted]);

  if (route.passo === null || incoming !== null) {
    return null;
  }

  const passo = route.passo;
  const back = (): void =>
    flow.back(route.href, passo > 1 ? stepHref("data", passo - 1) : receivingRoot);
  const next = (): void => {
    flow.confirmData(passo);
    flow.go(passo < PASSOS ? stepHref("data", passo + 1) : stepHref("documents"));
  };

  return (
    <StepPage
      step="data"
      items={receivingSteps(producer, flow.progress, {
        shown: "data",
        detail: `${passo} de ${PASSOS}`,
        retry: flow.stage.retry,
        accountStopped: account.stopped,
      })}
      notice={atRoot ? <ReceivingAccountNotice /> : null}
      onBack={back}
    >
      {passo === 1 ? <WhoPasso onContinue={next} /> : null}
      {passo === 2 ? <PhonePasso onContinue={next} onBack={back} /> : null}
      {passo === 3 ? <AddressPasso onContinue={next} onBack={back} /> : null}
    </StepPage>
  );
}
