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
}

export interface BlindPayBlockchainWallet {
  id: string;
  address: string;
  network: "stellar_testnet";
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

export interface BlindPayPayinQuoteInput {
  blockchainWalletId: string;
  requestAmountCents: number;
  token: string;
  partnerFeeId: string | undefined;
}

/** Amounts in minor units: BRL cents on the sender side, stablecoin units on the receiver side. */
export interface BlindPayPayinQuote {
  id: string;
  expiresAt: Date;
  senderAmount: number;
  receiverAmount: number;
  commercialQuotation: number;
  blindpayQuotation: number;
  flatFee: number;
  partnerFeeAmount: number;
}

export interface BlindPayPayin {
  id: string;
  status: string;
  pixCode: string;
}

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
  getCustomerKycStatus(customerId: string): Promise<BlindPayKycStatusValue>;
  getOpenRfi(customerId: string): Promise<BlindPayRfi | null>;
  submitRfi(customerId: string, answers: BlindPayRfiAnswers, idempotencyKey: string): Promise<void>;
  registerExternalStellarWallet(
    input: { customerId: string; address: string; name: string },
    idempotencyKey: string,
  ): Promise<BlindPayBlockchainWallet>;
  createPayinQuote(
    input: BlindPayPayinQuoteInput,
    idempotencyKey: string,
  ): Promise<BlindPayPayinQuote>;
  createPayin(quoteId: string, idempotencyKey: string): Promise<BlindPayPayin>;
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
