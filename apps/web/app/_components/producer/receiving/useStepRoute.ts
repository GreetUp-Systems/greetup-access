"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  parsePasso,
  type ReceivingStep,
  receivingRoot,
  resolveRoute,
  stepHref,
} from "../../../_lib/producer/receiving-flow";
import { useReceiving } from "./ReceivingProvider";

export interface StepRoute {
  /** The passo on the screen; null while the address leads elsewhere. */
  passo: number | null;
  /** This screen's address, to go back from it. */
  href: string;
  /** Where the redirect goes, when there is one. */
  redirect: string | null;
}

/**
 * The passo of a step from `?passo=N`, or the redirect to the first pending one (SPEC-015 §6). On
 * the desktop's root the current step shows its first passo there, at the root's address.
 * `termsAccepted` holds the acceptance that arrived in the address and is not stored yet.
 */
export function useStepRoute(
  step: ReceivingStep,
  atRoot: boolean,
  termsAccepted?: boolean,
): StepRoute {
  const params = useSearchParams();
  const router = useRouter();
  const { stage, progress } = useReceiving();
  const asked = atRoot ? 1 : parsePasso(params.get("passo"));
  const route = resolveRoute(
    stage,
    termsAccepted === true ? { ...progress, termsAccepted } : progress,
    step,
    asked,
  );
  const redirect = route.kind === "redirect" && !atRoot ? route.href : null;

  useEffect(() => {
    if (redirect !== null) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  return {
    passo: route.kind === "show" ? route.passo : atRoot ? 1 : null,
    href: atRoot ? receivingRoot : stepHref(step, asked),
    redirect,
  };
}
