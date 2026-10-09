"use client";

import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Button } from "@access/ui/components/button";
import type { ReactNode } from "react";

import { initials } from "../../_lib/producer/navigation";
import { useProducer } from "./ProducerContext";

interface PageHeaderProps {
  title: string;
  /** Under the title, Body/M in text/tertiary. */
  description: string;
  /** The phone's title and description, when the screen has others (the Painel). */
  mobileTitle?: string;
  mobileDescription?: string;
  /**
   * Figma: the page's actions: beside the title on the desktop; on the phone in a row below it,
   * one at each end when there are two.
   */
  actions?: ReactNode;
}

/** The desktop text, with the phone's in its place below md when the screen has one. */
function Responsive({ text, mobile }: { text: string; mobile: string | undefined }) {
  if (mobile === undefined) {
    return text;
  }
  return (
    <>
      <span className="md:hidden">{mobile}</span>
      <span className="hidden md:inline">{text}</span>
    </>
  );
}

/**
 * The top of a section's root page (Eventos, 307:2983 and 307:3341; Painel, 284:1571 and
 * 291:2431): Heading/H1 and its description; on the phone the avatar beside them opens the account
 * sheet (SPEC-015 N2).
 */
export function PageHeader({
  title,
  description,
  mobileTitle,
  mobileDescription,
  actions,
}: PageHeaderProps) {
  const { producer, openAccount } = useProducer();
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:gap-3">
      <div className="flex items-center md:flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0-5 md:gap-1">
          <h1 className="type-heading-h1 text-text-primary">
            <Responsive text={title} mobile={mobileTitle} />
          </h1>
          <p className="type-body-m text-text-tertiary">
            <Responsive text={description} mobile={mobileDescription} />
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-m"
          aria-label="Conta"
          onClick={openAccount}
          className="md:hidden"
        >
          <Avatar aria-hidden>
            <AvatarFallback>{initials(producer.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </div>
      {actions === undefined ? null : (
        <div className="flex items-center justify-between gap-2 md:justify-start">{actions}</div>
      )}
    </header>
  );
}
