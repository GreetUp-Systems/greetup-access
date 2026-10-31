import type { CustomerDraft, IdDocumentType, IndividualCustomerInput } from "../api/onboarding";
import { birthDateForApi, formatBirthDate, parseBirthDate } from "./birth-date";
import { isBrazilianUf } from "./cep";
import { isValidCpf } from "./cpf";
import { digitsOnly, maskCep, maskCpf, maskPhone } from "./masks";
import { internationalPhone } from "./phone";

// Seus dados and Documentos of the Recebimento (SPEC-015 §6, R8, R10): what the producer types,
// how each passo is checked, and the customer the API takes. The values stay in the page's memory
// until the submission; nothing here is stored.

/** Seus dados · 1 Quem é você, as typed: the CPF and the date with their masks. */
export interface PersonalFields {
  firstName: string;
  lastName: string;
  cpf: string;
  birthDate: string;
}

/** Seus dados · 3 Endereço: the CEP first, then what ViaCEP fills and the producer completes. */
export interface AddressFields {
  cep: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  /** One of the 27 UFs, or "" while none is chosen. */
  uf: string;
}

export interface ReceivingForm {
  personal: PersonalFields;
  /** Seus dados · 2 Telefone, masked: "(11) 91234-5678". */
  phone: string;
  address: AddressFields;
}

export const emptyForm: ReceivingForm = {
  personal: { firstName: "", lastName: "", cpf: "", birthDate: "" },
  phone: "",
  address: { cep: "", street: "", number: "", complement: "", city: "", uf: "" },
};

/** A field left empty, or filled with what is not a CPF, a date or a phone. */
export type FieldProblem = "required" | "invalid";

/** The messages of Seus dados (Figma 550:13631 and SPEC-015 §6), shown when leaving the field. */
export const fieldMessages = {
  required: "Preencha este campo.",
  cpf: "CPF inválido. Confira os números.",
  birthDate: "Data inválida. Use DD/MM/AAAA.",
  phone: "Telefone inválido. Use DDD e número.",
} as const;

/** What is wrong with one field of Quem é você; null when it is fine. */
export function personalProblem(
  field: keyof PersonalFields,
  value: string,
  today: Date = new Date(),
): FieldProblem | null {
  if (value.trim() === "") {
    return "required";
  }
  if (field === "cpf") {
    return isValidCpf(value) ? null : "invalid";
  }
  if (field === "birthDate") {
    return parseBirthDate(value, today).ok ? null : "invalid";
  }
  return null;
}

/** The problem of each field of Quem é você, in the order of the screen. */
export function personalProblems(
  personal: PersonalFields,
  today: Date = new Date(),
): Partial<Record<keyof PersonalFields, FieldProblem>> {
  const problems: Partial<Record<keyof PersonalFields, FieldProblem>> = {};
  for (const field of ["firstName", "lastName", "cpf", "birthDate"] as const) {
    const problem = personalProblem(field, personal[field], today);
    if (problem !== null) {
      problems[field] = problem;
    }
  }
  return problems;
}

export function phoneProblem(phone: string): FieldProblem | null {
  if (phone.trim() === "") {
    return "required";
  }
  return internationalPhone(phone) === null ? "invalid" : null;
}

/** The message under a field of Seus dados for its problem. */
export function fieldMessage(field: keyof PersonalFields | "phone", problem: FieldProblem): string {
  if (problem === "invalid" && (field === "cpf" || field === "birthDate" || field === "phone")) {
    return fieldMessages[field];
  }
  return fieldMessages.required;
}

/** Endereço can go on: the CEP's 8 digits, street, number, city and UF; the complement is optional. */
export function addressComplete(address: AddressFields): boolean {
  return (
    digitsOnly(address.cep).length === 8 &&
    address.street.trim() !== "" &&
    address.number.trim() !== "" &&
    address.city.trim() !== "" &&
    isBrazilianUf(address.uf)
  );
}

/**
 * How many passos of Seus dados are done in a row, 0 to 3: the next one is the first pending.
 * A later passo never counts before an earlier one is right.
 */
export function dataPassosDone(form: ReceivingForm, today: Date = new Date()): number {
  if (Object.keys(personalProblems(form.personal, today)).length > 0) {
    return 0;
  }
  if (phoneProblem(form.phone) !== null) {
    return 1;
  }
  return addressComplete(form.address) ? 3 : 2;
}

/** "Rua Augusta, 1200" back into the street and the number; without a comma, all is the street. */
export function splitAddressLine(line: string): { street: string; number: string } {
  const index = line.lastIndexOf(",");
  if (index < 0) {
    return { street: line.trim(), number: "" };
  }
  return { street: line.slice(0, index).trim(), number: line.slice(index + 1).trim() };
}

const brazilianDocuments: readonly IdDocumentType[] = ["ID_CARD", "DRIVERS", "PASSPORT"];

/**
 * The refused attempt's data in the form of the new one (SPEC-015 R2): the CPF, the date, the phone
 * and the CEP in their masks, the street and the number apart again, and the document type when it
 * is one of the three Brazilian documents. The files are always sent again.
 */
export function formFromDraft(draft: CustomerDraft): {
  form: ReceivingForm;
  documentType: IdDocumentType | null;
} {
  const text = (value: string | null): string => value?.trim() ?? "";
  const { street, number } = splitAddressLine(text(draft.addressLine1));
  const uf = text(draft.stateProvinceRegion).toUpperCase();
  return {
    form: {
      personal: {
        firstName: text(draft.firstName),
        lastName: text(draft.lastName),
        cpf: maskCpf(text(draft.taxId)),
        birthDate: draft.dateOfBirth === null ? "" : (formatBirthDate(draft.dateOfBirth) ?? ""),
      },
      phone: maskPhone(text(draft.phoneNumber)),
      address: {
        cep: maskCep(text(draft.postalCode)),
        street,
        number,
        complement: text(draft.addressLine2),
        city: text(draft.city),
        uf: isBrazilianUf(uf) ? uf : "",
      },
    },
    documentType:
      draft.idDocType !== null && brazilianDocuments.includes(draft.idDocType)
        ? draft.idDocType
        : null,
  };
}

/** A file of the verification sent to BlindPay: its name on the screen and its reference. */
export interface SentFile {
  name: string;
  fileUrl: string;
}

/** The document's sides and the selfie. */
export type DocumentSlot = "front" | "back" | "selfie";

/** The files each document asks for: RG and CNH have a back, the passport only its photo page. */
export function documentSlots(type: IdDocumentType): readonly DocumentSlot[] {
  return type === "PASSPORT" ? ["front", "selfie"] : ["front", "back", "selfie"];
}

/**
 * The customer of "Enviar para verificação" (SPEC-015 §6): an individual of KYC Standard with the
 * accepted terms. The CPF and the CEP go as digits, the phone as +55, the birth date as the API's
 * date-time, the street and the number as `addressLine1`, and the country is Brazil. Null while
 * something is missing, which the screens never let happen.
 */
export function customerInput({
  form,
  tosId,
  documentType,
  files,
}: {
  form: ReceivingForm;
  tosId: string;
  documentType: IdDocumentType;
  files: Partial<Record<DocumentSlot, SentFile>>;
}): IndividualCustomerInput | null {
  const birth = parseBirthDate(form.personal.birthDate);
  const phone = internationalPhone(form.phone);
  const front = files.front;
  const back = files.back;
  const selfie = files.selfie;
  const needsBack = documentType !== "PASSPORT";
  if (
    dataPassosDone(form) < 3 ||
    !birth.ok ||
    phone === null ||
    front === undefined ||
    selfie === undefined ||
    (needsBack && back === undefined)
  ) {
    return null;
  }
  const { address, personal } = form;
  const complement = address.complement.trim();
  return {
    type: "individual",
    kycType: "standard",
    tosId,
    firstName: personal.firstName.trim(),
    lastName: personal.lastName.trim(),
    dateOfBirth: birthDateForApi(birth.date),
    taxId: digitsOnly(personal.cpf),
    phoneNumber: phone,
    addressLine1: `${address.street.trim()}, ${address.number.trim()}`,
    ...(complement === "" ? {} : { addressLine2: complement }),
    city: address.city.trim(),
    stateProvinceRegion: address.uf,
    postalCode: digitsOnly(address.cep),
    country: "BR",
    idDocCountry: "BR",
    idDocType: documentType,
    idDocFrontFile: front.fileUrl,
    ...(needsBack && back !== undefined ? { idDocBackFile: back.fileUrl } : {}),
    selfieFile: selfie.fileUrl,
  };
}
