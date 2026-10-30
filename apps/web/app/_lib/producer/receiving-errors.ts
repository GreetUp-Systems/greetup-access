import { ApiError } from "../api/client";
import type { OnboardingFileRejection, OnboardingFileSlot } from "./onboarding-files";

// The API's errors of Criar perfil and Recebimento as the screen states of SPEC-015 §6 ("Erros da
// API → tela"), with the texts of the Figma.

const isApiError = (error: unknown, status: number, code?: string): boolean =>
  error instanceof ApiError &&
  error.status === status &&
  (code === undefined || error.code === code);

/** `POST /producers`: the name's error, the profile that already exists, the session, or a failure. */
export type ProfileProblem = "invalid_name" | "exists" | "signed_out" | "failed";

export function profileProblem(error: unknown): ProfileProblem {
  if (isApiError(error, 400, "invalid_producer_profile")) {
    return "invalid_name";
  }
  if (isApiError(error, 409, "producer_already_exists")) {
    return "exists";
  }
  if (isApiError(error, 401)) {
    return "signed_out";
  }
  // Network, 5xx and anything unexpected: Criar perfil · Falha, with "Tentar de novo".
  return "failed";
}

/** Criar perfil · Nome vazio (519:9493) and the API's 400 invalid_producer_profile. */
export const profileNameMessage = "Escreva o nome que vai aparecer para quem compra.";

/** Why a file of the verification is not in: the browser's checks and the API's answers. */
export type FileProblem =
  "type_not_allowed" | "pdf_too_large" | "photo_unusable" | "unusable" | "refused" | "failed";

/** The browser's check before the upload; an empty file is unusable. */
export function fileProblemFromCheck(reason: OnboardingFileRejection): FileProblem {
  return reason === "empty" ? "unusable" : reason;
}

/**
 * `POST .../files`: 413 is a file above the API's cap, 400 `invalid_onboarding_file` a file it
 * could not use, 422 `document_upload_failed` BlindPay's refusal; the network and 503 are Falha no
 * arquivo, to try again.
 */
export function fileProblemFromUpload(error: unknown): FileProblem {
  if (isApiError(error, 413)) {
    return "pdf_too_large";
  }
  if (isApiError(error, 400, "invalid_onboarding_file")) {
    return "unusable";
  }
  if (isApiError(error, 422, "document_upload_failed")) {
    return "refused";
  }
  return "failed";
}

/** The line of Envio de arquivo in the error state (Figma 548:13394, 548:14010, 548:13712). */
export function fileProblemMessage(problem: FileProblem, slot: OnboardingFileSlot): string {
  switch (problem) {
    case "type_not_allowed":
      return slot === "selfie"
        ? "A selfie precisa ser uma foto em JPG ou PNG."
        : "O documento precisa ser PDF, JPG ou PNG.";
    case "pdf_too_large":
      return "PDF maior que 3 MB. Escolha outro arquivo.";
    case "photo_unusable":
      return "Não deu para usar esta foto. Escolha outra.";
    case "unusable":
      return "Não deu para usar este arquivo. Escolha outro.";
    case "refused":
      return "A BlindPay não aceitou este arquivo. Escolha outro.";
    case "failed":
      return "Não deu para enviar o arquivo. Tente de novo.";
  }
}

/**
 * `POST .../customer`: an earlier submission still in progress (Envio em processamento), BlindPay's
 * refusal of the data (Envio recusado, "Revisar dados") or a failure that the same request may get
 * past (Falha no envio, "Tentar de novo" with the same key).
 */
export type SubmissionProblem = "busy" | "refused" | "failed";

export function submissionProblem(error: unknown): SubmissionProblem {
  if (isApiError(error, 409, "customer_attempt_already_active")) {
    return "busy";
  }
  if (
    isApiError(error, 422, "customer_creation_failed") ||
    isApiError(error, 422, "customer_attempt_failed") ||
    isApiError(error, 400, "invalid_onboarding_input")
  ) {
    return "refused";
  }
  return "failed";
}
