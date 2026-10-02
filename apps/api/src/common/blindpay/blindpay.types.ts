export type BlindPayCustomerTypeValue = "individual" | "business";
export type BlindPayKycStatusValue =
  "verifying" | "approved" | "rejected" | "compliance_request" | "approved_rfi";

export interface BlindPayTermsSession {
  url: string;
}

export interface BlindPayUploadedDocument {
  fileUrl: string;
}

export interface BlindPayCreatedCustomer {
  id: string;
  kycStatus: BlindPayKycStatusValue;
}

export interface BlindPayRfiField {
  key: string;
  label: string;
  required: boolean;
  regex?: string;
  items?: Array<{ label: string; value: string }>;
  multiple?: boolean;
}

export interface BlindPayRfiSection {
  title: string;
  description: string;
  supportingDocument?: string;
  fields: BlindPayRfiField[];
}

export interface BlindPayRfi {
  id: string;
  status: "pending" | "submitted" | "expired" | "cancelled";
  request: BlindPayRfiSection[];
  expiresAt: string;
  createdAt: string;
}

export type BlindPayRfiAnswers = Record<string, string | string[]>;

export interface BlindPayGateway {
  createTermsOfServiceUrl(input: {
    idempotencyKey: string;
    redirectUrl: string;
  }): Promise<BlindPayTermsSession>;
  uploadDocument(
    input: { filename: string; mimeType: string; content: Buffer },
    idempotencyKey: string,
  ): Promise<BlindPayUploadedDocument>;
  createCustomer(
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BlindPayCreatedCustomer>;
  getOpenRfi(customerId: string): Promise<BlindPayRfi | null>;
  submitRfi(customerId: string, answers: BlindPayRfiAnswers, idempotencyKey: string): Promise<void>;
}

export class BlindPayProviderError extends Error {
  constructor(
    readonly operation: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
    readonly providerCode?: string,
  ) {
    super(`BlindPay operation failed: ${operation}`);
    this.name = "BlindPayProviderError";
  }
}

export const BLINDPAY_GATEWAY = Symbol("BLINDPAY_GATEWAY");
export const BLINDPAY_WEBHOOK_SECRET = Symbol("BLINDPAY_WEBHOOK_SECRET");
export const BLINDPAY_ALLOWED_REDIRECT_ORIGINS = Symbol("BLINDPAY_ALLOWED_REDIRECT_ORIGINS");
