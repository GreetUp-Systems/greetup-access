import { type BlindPayKycStatusValue, type BlindPayRfi } from "../common/blindpay/blindpay.types";

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
