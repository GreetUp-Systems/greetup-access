"use client";

import { createContext, useContext } from "react";

import type { ProducerEvent, ProducerProfile } from "../../_lib/api/producer";

export interface ProducerContextValue {
  producer: ProducerProfile;
  /** All the producer's events, as GET /events returns them. */
  events: ProducerEvent[];
  /** The signed-in e-mail, beside the name in the account menu and sheet. */
  email: string;
  /** Reads the events again in the background (a page that lists them opens). */
  reloadEvents: () => Promise<void>;
  /** Reads the producer again (after a step the producer took). */
  reloadProducer: () => Promise<void>;
  /** Opens the account sheet, from the avatar at the top of a phone screen. */
  openAccount: () => void;
}

export const ProducerContext = createContext<ProducerContextValue | null>(null);

/** The open producer system's data; only inside the system's layout. */
export function useProducer(): ProducerContextValue {
  const context = useContext(ProducerContext);
  if (context === null) {
    throw new Error("useProducer must be used inside the producer system's layout.");
  }
  return context;
}
