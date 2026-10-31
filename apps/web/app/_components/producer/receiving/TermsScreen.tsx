"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { createTermsSession } from "../../../_lib/api/onboarding";
import { receivingRoot, receivingSteps } from "../../../_lib/producer/receiving-flow";
import { isTermsUrl, termsRedirectUrl } from "../../../_lib/producer/terms";
import { useSession } from "../../../_lib/session";
import { useProducer } from "../ProducerContext";
import { StepCard, StepPage } from "./ReceivingFrame";
import { useReceiving } from "./ReceivingProvider";
import { ReceivingAccountNotice } from "./ReceivingResult";
import { useStepRoute } from "./useStepRoute";

const description =
  "A BlindPay processa os pagamentos dos seus ingressos: o Pix de quem compra vira saldo na sua conta de recebimento. Para receber, aceite os termos dela.";
const retryDescription =
  "Cada verificação pede um novo aceite dos termos da BlindPay. Depois do aceite, seus dados voltam preenchidos para você corrigir, e os documentos são enviados de novo.";

/**
 * Figma: Recebimento · Termos (301:2818, 302:4201), Falha ao abrir (520:9000, 519:9557), Sem aceite
 * (520:9102, 519:9623) and Nova tentativa (499:4710, 501:5493). BlindPay's terms open on its site
 * and come back to Seus dados with the acceptance (SPEC-015 §6).
 */
export function TermsScreen({ atRoot = false }: { atRoot?: boolean }) {
  const { producer, account } = useProducer();
  const { getToken } = useSession();
  const flow = useReceiving();
  const route = useStepRoute("terms", atRoot);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);

  if (route.passo === null) {
    return null;
  }

  const open = async (): Promise<void> => {
    flow.setTermsNotAccepted(false);
    setFailed(false);
    setOpening(true);
    try {
      const { url } = await createTermsSession(
        await getToken(),
        termsRedirectUrl(window.location.origin),
      );
      if (!isTermsUrl(url)) {
        throw new Error("The terms' address is not https.");
      }
      // The page leaves for BlindPay; the button keeps its spinner until it does.
      window.location.assign(url);
    } catch {
      setOpening(false);
      setFailed(true);
    }
  };

  let notice = null;
  if (failed) {
    notice = (
      <Alert
        tone="danger"
        action={
          <Button variant="ghost" size="s" onClick={() => void open()}>
            Tentar de novo
          </Button>
        }
      >
        <AlertTitle>Não deu para abrir os termos</AlertTitle>
        <AlertDescription>Confira sua conexão e tente de novo.</AlertDescription>
      </Alert>
    );
  } else if (flow.termsNotAccepted) {
    notice = (
      <Alert tone="warning">
        <AlertTitle>Os termos não foram aceitos</AlertTitle>
        <AlertDescription>Para continuar, aceite os termos da BlindPay.</AlertDescription>
      </Alert>
    );
  }

  return (
    <StepPage
      step="terms"
      items={receivingSteps(producer, flow.progress, {
        shown: "terms",
        detail: "Agora",
        retry: flow.stage.retry,
        accountStopped: account.stopped,
      })}
      notice={
        <>
          {atRoot ? <ReceivingAccountNotice /> : null}
          {notice}
        </>
      }
      onBack={() => flow.back(route.href, receivingRoot)}
    >
      <StepCard
        title="Termos da BlindPay"
        description={flow.stage.retry ? retryDescription : description}
        action={
          <Button
            variant="inverse"
            size="l"
            className="w-full md:w-auto"
            iconRight={<ExternalLink aria-hidden />}
            loading={opening}
            onClick={() => void open()}
          >
            Ler e aceitar os termos
          </Button>
        }
        note="Os termos abrem no site da BlindPay. Depois do aceite, você volta para cá."
      />
    </StepPage>
  );
}
