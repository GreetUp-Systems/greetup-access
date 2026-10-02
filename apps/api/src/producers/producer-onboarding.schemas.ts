import { z } from "zod";

const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(2_000);
const country = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/);
const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");
const isoDate = z.string().datetime({ offset: true });
const idDocumentType = z.enum(["PASSPORT", "ID_CARD", "DRIVERS"]);
const proofOfAddressType = z.enum([
  "UTILITY_BILL",
  "BANK_STATEMENT",
  "RENTAL_AGREEMENT",
  "TAX_DOCUMENT",
  "GOVERNMENT_CORRESPONDENCE",
]);

const addressSchema = {
  taxId: shortText,
  addressLine1: shortText,
  addressLine2: shortText.optional(),
  city: shortText,
  stateProvinceRegion: shortText,
  country,
  postalCode: shortText,
  phoneNumber: shortText,
  proofOfAddressDocType: proofOfAddressType.optional(),
  proofOfAddressDocFile: httpsUrl.optional(),
};

const ownerSchema = z
  .object({
    role: z.enum(["beneficial_controlling", "beneficial_owner", "controlling_person"]),
    title: shortText.optional(),
    ownershipPercentage: z.number().min(0).max(100).optional(),
    firstName: shortText,
    lastName: shortText,
    dateOfBirth: isoDate,
    taxId: shortText,
    addressLine1: shortText,
    addressLine2: shortText.optional(),
    city: shortText,
    stateProvinceRegion: shortText,
    country,
    postalCode: shortText,
    idDocCountry: country,
    idDocType: idDocumentType,
    idDocFrontFile: httpsUrl,
    idDocBackFile: httpsUrl.optional(),
    proofOfAddressDocType: proofOfAddressType.optional(),
    proofOfAddressDocFile: httpsUrl.optional(),
  })
  .strict();

const individualCustomerSchema = z
  .object({
    type: z.literal("individual"),
    kycType: z.literal("standard"),
    tosId: shortText,
    ...addressSchema,
    firstName: shortText,
    lastName: shortText,
    dateOfBirth: isoDate,
    idDocCountry: country,
    idDocType: idDocumentType,
    idDocFrontFile: httpsUrl,
    idDocBackFile: httpsUrl.optional(),
    selfieFile: httpsUrl,
  })
  .strict();

const businessCustomerSchema = z
  .object({
    type: z.literal("business"),
    kycType: z.literal("standard"),
    tosId: shortText,
    ...addressSchema,
    legalName: shortText,
    alternateName: shortText.optional(),
    formationDate: isoDate,
    website: httpsUrl.optional(),
    businessDescription: longText.optional(),
    owners: z.array(ownerSchema).min(1).max(20),
    incorporationDocFile: httpsUrl,
    proofOfOwnershipDocFile: httpsUrl,
  })
  .strict();

export const createBlindPayCustomerSchema = z.discriminatedUnion("type", [
  individualCustomerSchema,
  businessCustomerSchema,
]);

export const termsRequestSchema = z
  .object({
    redirectUrl: z.string().url(),
  })
  .strict();

export const idempotencyKeySchema = z.string().uuid();

export type CreateBlindPayCustomerInput = z.infer<typeof createBlindPayCustomerSchema>;
