import {
  type BlindPayCustomerDraft,
  type BlindPayCustomerStatus,
  type BlindPayKycStatusValue,
  type BlindPayKycWarning,
  type BlindPayRfi,
} from "../common/blindpay/blindpay.types";

/** The current attempt read live from BlindPay; nothing of it is stored or logged (SPEC-015 P3). */
export interface CustomerAttemptView {
  status: BlindPayCustomerStatus;
  reasons: BlindPayKycWarning[];
  draft: BlindPayCustomerDraft;
}

export interface CreatedCustomerView {
  id: string;
  customerId: string;
  type: "individual" | "business";
  status: BlindPayKycStatusValue;
}

export interface TermsSessionView {
  url: string;
}

export interface UploadedDocumentView {
  fileUrl: string;
}

export type OpenRfiView = BlindPayRfi | null;

export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
