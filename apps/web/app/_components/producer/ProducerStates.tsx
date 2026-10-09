"use client";

import { Alert, AlertDescription, AlertTitle } from "@access/ui/components/alert";
import { Button } from "@access/ui/components/button";
import { Skeleton } from "@access/ui/components/skeleton";
import { cn } from "@access/ui/lib/utils";

/** An esqueleto as wide as a text in that typography, so the shape matches what will come. */
function TextSkeleton({ text, type, height }: { text: string; type: string; height?: string }) {
  return (
    <Skeleton className={cn("w-fit overflow-hidden rounded-sm", height)}>
      <span className={cn("invisible block whitespace-nowrap", type)}>{text}</span>
    </Skeleton>
  );
}

/**
 * Figma: Desktop · Sistema · Carregando (430:6770) and Mobile (430:17165): the page as esqueletos
 * while the session, the producer and the events load: the header and a card of rows.
 */
export function ProducerLoading() {
  return (
    <div aria-busy className="flex flex-col gap-4 md:gap-6">
      <span role="status" className="sr-only">
        Carregando
      </span>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TextSkeleton text="Eventos" type="type-heading-h1" />
          <TextSkeleton text="Todos os seus eventos" type="type-body-m" />
        </div>
        <div className="flex size-control-md shrink-0 items-center justify-center md:hidden">
          <Skeleton className="size-avatar-s rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 md:p-6">
        {["Festival de Inverno", "Feira Criativa", "Noite de Jazz"].map((name) => (
          <div key={name} className="flex items-center gap-3">
            <Skeleton className="size-control-md shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-2">
              <TextSkeleton text={name} type="type-body-m-strong" height="h-4" />
              <TextSkeleton text="Casa Fluida · São Paulo" type="type-body-s" height="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Figma: the account at the bottom of the sidebar while it loads (Esqueleto · Conta). */
export function AccountSkeleton() {
  return (
    <div
      aria-hidden
      className="flex w-full items-center gap-3 rounded-md bg-bg-canvas p-2 inset-ring inset-ring-border-subtle group-data-[collapsible=icon]:w-control-md group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0-5"
    >
      <Skeleton className="size-avatar-m shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col gap-2 group-data-[collapsible=icon]:hidden">
        <TextSkeleton text="Casa Fluida" type="type-body-m-strong" height="h-3" />
        <TextSkeleton text="voce@email.com" type="type-body-s" height="h-3" />
      </div>
    </div>
  );
}

/**
 * Figma: Desktop · Sistema · Erro (430:17034) and Mobile (430:17265): the system could not load;
 * the connection notice of the checkout and "Tentar de novo".
 */
export function ProducerFailed({ onRetry }: { onRetry: () => void }) {
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
