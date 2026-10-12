"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";

/**
 * A page that could not load (Figma: Sistema · Erro, 430:17034 and 430:17265; Meus ingressos · Erro,
 * 465:18436 and 465:18576): the connection notice of the checkout and "Tentar de novo".
 */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <Alert tone="danger" className="md:max-w-content-column">
        <AlertTitle>Sem conexão</AlertTitle>
        <AlertDescription>
          Não conseguimos falar com o Access. Confira a internet e tente de novo.
        </AlertDescription>
      </Alert>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}
