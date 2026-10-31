import type { OpenRfi, RfiAnswers, RfiField, RfiSection } from "../api/onboarding";
import { fieldMessages, type SentFile } from "./receiving-data";

// BlindPay's request for information (SPEC-015 §6 "Campos do RFI", R10): one section per screen,
// at /producer/receiving/rfi?passo=N, each field as the screen shows it, the checks before the
// single answer and the body of that answer.

export const rfiPath = "/producer/receiving/rfi";

/** The address of a question; the first has no ?passo. */
export function rfiHref(passo = 1): string {
  return passo > 1 ? `${rfiPath}?passo=${passo}` : rfiPath;
}

/**
 * How a field is answered: a field with `items` is a list (the browser's own, R8); a file field
 * (its key ends in `_file` or `_files`, or it takes `multiple`) is an Envio de arquivo; the rest
 * is a Campo de texto.
 */
export type RfiFieldKind = "list" | "file" | "text";

export function rfiFieldKind(field: RfiField): RfiFieldKind {
  if (field.items !== undefined) {
    return "list";
  }
  return /_files?$/.test(field.key) || field.multiple === true ? "file" : "text";
}

/** What the producer gave so far: the text or the list's value by key, and the files sent. */
export interface RfiDraft {
  values: Readonly<Record<string, string>>;
  /** The files sent to BlindPay through the API, which gives back their URLs. */
  files: Readonly<Record<string, SentFile>>;
}

export const emptyRfiDraft: RfiDraft = { values: {}, files: {} };

/** A field left empty while required, or out of the format the request asks for (`regex`). */
export type RfiProblem = "required" | "format";

/** The field's answer as it is sent: the text without the spaces around it, or the file's URL. */
function answerOf(field: RfiField, draft: RfiDraft): string {
  if (rfiFieldKind(field) === "file") {
    return draft.files[field.key]?.fileUrl ?? "";
  }
  return (draft.values[field.key] ?? "").trim();
}

/** The request's own pattern, as the API applies it; one that does not compile is left to it. */
function pattern(source: string): RegExp | null {
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

/** Checks a field before the answer is sent, as the API does (SPEC-003 §8). */
export function rfiFieldProblem(field: RfiField, draft: RfiDraft): RfiProblem | null {
  const value = answerOf(field, draft);
  if (value === "") {
    return field.required ? "required" : null;
  }
  if (field.items !== undefined && !field.items.some((item) => item.value === value)) {
    return "required";
  }
  if (field.regex !== undefined && pattern(field.regex)?.test(value) === false) {
    return "format";
  }
  return null;
}

/** The message under the field (Figma 544:10219 and 544:10360). */
export function rfiProblemMessage(problem: RfiProblem): string {
  return problem === "required"
    ? fieldMessages.required
    : "Confira o formato pedido na mensagem acima.";
}

/** The problems of a section's fields, by key. */
export function rfiSectionProblems(
  section: RfiSection,
  draft: RfiDraft,
): Partial<Record<string, RfiProblem>> {
  const problems: Partial<Record<string, RfiProblem>> = {};
  for (const field of section.fields) {
    const problem = rfiFieldProblem(field, draft);
    if (problem !== null) {
      problems[field.key] = problem;
    }
  }
  return problems;
}

/** How many sections, from the first, are answered as the request asks. */
export function rfiSectionsDone(rfi: OpenRfi, draft: RfiDraft): number {
  let done = 0;
  for (const section of rfi.request) {
    if (Object.keys(rfiSectionProblems(section, draft)).length > 0) {
      break;
    }
    done += 1;
  }
  return done;
}

/** The question (from 1) that holds a field, or null when the request has no such key. */
export function rfiPassoOf(rfi: OpenRfi, key: string): number | null {
  const index = rfi.request.findIndex((section) =>
    section.fields.some((field) => field.key === key),
  );
  return index === -1 ? null : index + 1;
}

/** One question per section; a request without sections still has the screen that sends it. */
export function rfiQuestionCount(rfi: OpenRfi): number {
  return Math.max(1, rfi.request.length);
}

/**
 * The single answer (SPEC-003 §8): each field answered, by its key, as a list for a field with
 * `multiple`; an optional field left empty is left out, since the API refuses an empty value.
 */
export function rfiAnswersBody(rfi: OpenRfi, draft: RfiDraft): RfiAnswers {
  const body: RfiAnswers = {};
  for (const field of rfi.request.flatMap((section) => section.fields)) {
    const value = answerOf(field, draft);
    if (value !== "") {
      body[field.key] = field.multiple === true ? [value] : value;
    }
  }
  return body;
}

export type RfiRoute = { kind: "show"; passo: number } | { kind: "redirect"; href: string };

/**
 * The question an address shows, or the first one still to answer: a question opens once the ones
 * before it were answered and the producer went on from them (`done`).
 */
export function resolveRfiRoute(total: number, done: number, asked: number): RfiRoute {
  const first = Math.min(done + 1, total);
  return asked <= first
    ? { kind: "show", passo: asked }
    : { kind: "redirect", href: rfiHref(first) };
}
