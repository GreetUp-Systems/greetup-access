import type { AccountActivationView } from "./account";
import { apiRequest } from "./client";
import type { KycStatus, ProducerProfile } from "./producer";

// Mirrors of the producer onboarding routes (apps/api/src/producers: producers.controller.ts and
// producer-onboarding.controller.ts; SPEC-003 §8 and SPEC-015 §6 and §8).

/**
 * Creates the producer profile of the signed-in account (Criar perfil). 400
 * `invalid_producer_profile` for a name outside 1 to 120 characters; 409 `producer_already_exists`
 * when the account already has a profile with another name.
 */
export function createProducer(token: string, displayName: string): Promise<ProducerProfile> {
  return apiRequest<ProducerProfile>("/producers", {
    method: "POST",
    token,
    body: { displayName },
  });
}

export interface TermsSession {
  /** BlindPay's page of the terms, which comes back to `redirectUrl` with `tos_id`. */
  url: string;
}

/**
 * Opens BlindPay's terms (SPEC-015 §6, Termos). `redirectUrl` must be on an origin the API
 * allows (400 `redirect_origin_not_allowed`); a refused session is 422 `terms_session_failed`.
 */
export function createTermsSession(token: string, redirectUrl: string): Promise<TermsSession> {
  return apiRequest<TermsSession>("/producers/onboarding/tos", {
    method: "POST",
    token,
    body: { redirectUrl },
  });
}

export interface UploadedDocument {
  /** BlindPay's reference to the file, sent with the customer. */
  fileUrl: string;
}

/**
 * Sends one file of the verification, a PDF, JPEG or PNG up to 3 MB, straight to BlindPay through
 * the API, which keeps no copy (SPEC-003 §8). The same key for a repeated try of the same file.
 * 400 `invalid_onboarding_file`, 413 above the upload cap, 422 `document_upload_failed`.
 */
export function uploadOnboardingFile(
  token: string,
  file: File,
  idempotencyKey: string,
): Promise<UploadedDocument> {
  const form = new FormData();
  form.append("file", file, file.name);
  return apiRequest<UploadedDocument>("/producers/onboarding/files", {
    method: "POST",
    token,
    body: form,
    idempotencyKey,
  });
}

/** Only Brazilian documents (SPEC-015 R8): RG, CNH or passport. */
export type IdDocumentType = "ID_CARD" | "DRIVERS" | "PASSPORT";

export type ProofOfAddressType =
  | "UTILITY_BILL"
  | "BANK_STATEMENT"
  | "RENTAL_AGREEMENT"
  | "TAX_DOCUMENT"
  | "GOVERNMENT_CORRESPONDENCE";

/**
 * The individual customer of the API (KYC Standard): only individuals in the pilot (SPEC-015 P1).
 * `dateOfBirth` is an ISO 8601 date-time with an offset; the `*File` fields are `fileUrl`s.
 */
export interface IndividualCustomerInput {
  type: "individual";
  kycType: "standard";
  tosId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  taxId: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvinceRegion: string;
  postalCode: string;
  country: string;
  idDocCountry: string;
  idDocType: IdDocumentType;
  idDocFrontFile: string;
  idDocBackFile?: string;
  selfieFile: string;
  proofOfAddressDocType?: ProofOfAddressType;
  proofOfAddressDocFile?: string;
}

export interface CreatedCustomer {
  id: string;
  customerId: string;
  type: "individual" | "business";
  status: KycStatus;
}

/**
 * Sends the data and the files to BlindPay's verification ("Enviar para verificação"). The same
 * key repeats the same submission (SPEC-015 §6). 409 `customer_attempt_already_active`, 422
 * `customer_creation_failed` or `customer_attempt_failed`, 400 `invalid_onboarding_input`.
 */
export function createCustomer(
  token: string,
  input: IndividualCustomerInput,
  idempotencyKey: string,
): Promise<CreatedCustomer> {
  return apiRequest<CreatedCustomer>("/producers/onboarding/customer", {
    method: "POST",
    token,
    body: input,
    idempotencyKey,
  });
}

/** BlindPay's `kyc_status`, including the ones the Access never sets. */
export type CustomerStatus =
  | "verifying"
  | "approved"
  | "rejected"
  | "deprecated"
  | "pending_review"
  | "awaiting_contract"
  | "compliance_request"
  | "approved_rfi";

/** An unresolved warning of the verification: AiPrise's code and BlindPay's English message. */
export interface CustomerReason {
  code: string;
  message: string;
}

/** The data of the attempt, without files, to fill the next one (SPEC-015 R2). */
export interface CustomerDraft {
  firstName: string | null;
  lastName: string | null;
  /** YYYY-MM-DD. */
  dateOfBirth: string | null;
  taxId: string | null;
  phoneNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvinceRegion: string | null;
  postalCode: string | null;
  country: string | null;
  idDocCountry: string | null;
  idDocType: IdDocumentType | null;
}

export interface CustomerAttempt {
  status: CustomerStatus;
  reasons: CustomerReason[];
  draft: CustomerDraft;
}

/**
 * The current attempt read live from BlindPay (SPEC-015 §8): its status, the reasons of a refusal
 * and its data. 404 `blindpay_customer_not_found` without an attempt.
 */
export function getCustomerAttempt(token: string): Promise<CustomerAttempt> {
  return apiRequest<CustomerAttempt>("/producers/onboarding/customer", { token });
}

export interface RfiField {
  key: string;
  label: string;
  required: boolean;
  regex?: string;
  items?: Array<{ label: string; value: string }>;
  multiple?: boolean;
}

export interface RfiSection {
  title: string;
  description: string;
  supportingDocument?: string;
  fields: RfiField[];
}

export interface OpenRfi {
  id: string;
  status: "pending" | "submitted" | "expired" | "cancelled";
  /** The sections, with the compliance's text as it came (SPEC-015 §6). */
  request: RfiSection[];
  expiresAt: string;
  createdAt: string;
}

/** The open request for information of the current BlindPay customer, or null. */
export function getOpenRfi(token: string): Promise<OpenRfi | null> {
  return apiRequest<OpenRfi | null>("/producers/onboarding/rfi", { token });
}

/** One answer per field key: a list for a field with `multiple`. */
export type RfiAnswers = Record<string, string | string[]>;

/**
 * The single answer to the open request (SPEC-015 §6). 400 `invalid_rfi_response` (with the
 * `field`), 404 `rfi_not_found`, 422 `rfi_submission_failed`.
 */
export async function submitRfi(
  token: string,
  answers: RfiAnswers,
  idempotencyKey: string,
): Promise<void> {
  await apiRequest<null>("/producers/onboarding/rfi", {
    method: "POST",
    token,
    body: answers,
    idempotencyKey,
  });
}

/** The same contract as the buyer's activation (SPEC-003 §8): "signing" carries the hash. */
export type ProducerActivationView = AccountActivationView;

/**
 * Prepares what is pending of the receiving account (SPEC-003 §10): the Stellar setup and, once
 * the verification is operational, the BlindPay wallet. 502 `stellar_activation_failed` is
 * definitive; 503 is passing; 502 or 503 `blindpay_wallet_registration_failed` on the wallet.
 */
export function prepareProducerActivation(token: string): Promise<ProducerActivationView> {
  return apiRequest<ProducerActivationView>("/producers/onboarding/stellar/activate", {
    method: "POST",
    token,
  });
}

/** Sends the wallet's signature of the prepared hash; 409 `activation_signature_stale`. */
export function submitProducerActivationSignature(
  token: string,
  body: { hash: string; signature: string },
): Promise<ProducerActivationView> {
  return apiRequest<ProducerActivationView>("/producers/onboarding/stellar/activate/signature", {
    method: "POST",
    token,
    body,
  });
}
