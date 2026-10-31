import type { CustomerDraft } from "../api/onboarding";
import {
  addressComplete,
  customerInput,
  dataPassosDone,
  documentSlots,
  emptyForm,
  fieldMessage,
  formFromDraft,
  personalProblem,
  personalProblems,
  phoneProblem,
  type ReceivingForm,
  splitAddressLine,
} from "./receiving-data";

// The browser's day: local time, so the test reads the same in any time zone.
const today = new Date(2026, 9, 30, 12, 0, 0);

const form: ReceivingForm = {
  personal: {
    firstName: " Ana ",
    lastName: "Souza",
    cpf: "123.456.789-09",
    birthDate: "15/03/1990",
  },
  phone: "(11) 91234-5678",
  address: {
    cep: "01310-100",
    street: "Rua Augusta",
    number: "1200",
    complement: "Apto 42",
    city: "São Paulo",
    uf: "SP",
  },
};

const files = {
  front: { name: "rg-frente.jpg", fileUrl: "https://files.blindpay.test/front" },
  back: { name: "rg-verso.jpg", fileUrl: "https://files.blindpay.test/back" },
  selfie: { name: "selfie.jpg", fileUrl: "https://files.blindpay.test/selfie" },
};

describe("Quem é você", () => {
  it("asks for every field and checks the CPF's digits and the date", () => {
    expect(personalProblem("firstName", "  ", today)).toBe("required");
    expect(personalProblem("firstName", "Ana", today)).toBeNull();
    expect(personalProblem("cpf", "123.456.789-09", today)).toBeNull();
    expect(personalProblem("cpf", "123.456.789-00", today)).toBe("invalid");
    expect(personalProblem("birthDate", "15/03/1990", today)).toBeNull();
    expect(personalProblem("birthDate", "15/03/19", today)).toBe("invalid");
    expect(personalProblem("birthDate", "31/12/1899", today)).toBe("invalid");
  });

  it("lists the problems of the screen (550:13631)", () => {
    expect(personalProblems(form.personal, today)).toEqual({});
    expect(
      personalProblems(
        { firstName: "Ana", lastName: "", cpf: "123.456.789-00", birthDate: "15/03/19" },
        today,
      ),
    ).toEqual({ lastName: "required", cpf: "invalid", birthDate: "invalid" });
  });

  it("says how to fix each field", () => {
    expect(fieldMessage("cpf", "invalid")).toBe("CPF inválido. Confira os números.");
    expect(fieldMessage("birthDate", "invalid")).toBe("Data inválida. Use DD/MM/AAAA.");
    expect(fieldMessage("phone", "invalid")).toBe("Telefone inválido. Use DDD e número.");
    expect(fieldMessage("cpf", "required")).toBe("Preencha este campo.");
    expect(fieldMessage("firstName", "required")).toBe("Preencha este campo.");
  });
});

describe("Telefone", () => {
  it("takes a Brazilian phone with its DDD", () => {
    expect(phoneProblem("(11) 91234-5678")).toBeNull();
    expect(phoneProblem("(11) 2345-6789")).toBeNull();
    expect(phoneProblem("")).toBe("required");
    expect(phoneProblem("91234-5678")).toBe("invalid");
  });
});

describe("Endereço", () => {
  it("goes on with the CEP, street, number, city and state; the complement is optional", () => {
    expect(addressComplete(form.address)).toBe(true);
    expect(addressComplete({ ...form.address, complement: "" })).toBe(true);
    expect(addressComplete({ ...form.address, cep: "01310-10" })).toBe(false);
    expect(addressComplete({ ...form.address, number: " " })).toBe(false);
    expect(addressComplete({ ...form.address, uf: "" })).toBe(false);
    expect(addressComplete({ ...form.address, uf: "XX" })).toBe(false);
  });

  it("takes the street and the number apart again", () => {
    expect(splitAddressLine("Rua Augusta, 1200")).toEqual({
      street: "Rua Augusta",
      number: "1200",
    });
    expect(splitAddressLine("Av. Brasil, 12, fundos")).toEqual({
      street: "Av. Brasil, 12",
      number: "fundos",
    });
    expect(splitAddressLine("Rua sem número")).toEqual({ street: "Rua sem número", number: "" });
  });
});

describe("dataPassosDone", () => {
  it("counts the passos right in a row", () => {
    expect(dataPassosDone(emptyForm, today)).toBe(0);
    expect(dataPassosDone({ ...emptyForm, personal: form.personal }, today)).toBe(1);
    expect(dataPassosDone({ ...form, address: emptyForm.address }, today)).toBe(2);
    expect(dataPassosDone(form, today)).toBe(3);
    // A later passo never counts before an earlier one.
    expect(dataPassosDone({ ...form, phone: "" }, today)).toBe(1);
  });
});

describe("formFromDraft", () => {
  const draft: CustomerDraft = {
    firstName: "Ana",
    lastName: "Souza",
    dateOfBirth: "1990-03-15",
    taxId: "12345678909",
    phoneNumber: "+5511912345678",
    addressLine1: "Rua Augusta, 1200",
    addressLine2: "Apto 42",
    city: "São Paulo",
    stateProvinceRegion: "SP",
    postalCode: "01310100",
    country: "BR",
    idDocCountry: "BR",
    idDocType: "DRIVERS",
  };

  it("fills the new attempt with the refused one's data, in the fields' masks (R2)", () => {
    expect(formFromDraft(draft)).toEqual({
      form: {
        personal: {
          firstName: "Ana",
          lastName: "Souza",
          cpf: "123.456.789-09",
          birthDate: "15/03/1990",
        },
        phone: "(11) 91234-5678",
        address: {
          cep: "01310-100",
          street: "Rua Augusta",
          number: "1200",
          complement: "Apto 42",
          city: "São Paulo",
          uf: "SP",
        },
      },
      documentType: "DRIVERS",
    });
  });

  it("leaves empty what the draft does not have", () => {
    const empty: CustomerDraft = {
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      taxId: null,
      phoneNumber: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateProvinceRegion: "Somewhere",
      postalCode: null,
      country: null,
      idDocCountry: null,
      idDocType: null,
    };
    expect(formFromDraft(empty)).toEqual({ form: emptyForm, documentType: null });
  });
});

describe("customerInput", () => {
  it("sends an individual of KYC Standard as the API takes it", () => {
    expect(customerInput({ form, tosId: "to_123", documentType: "ID_CARD", files })).toEqual({
      type: "individual",
      kycType: "standard",
      tosId: "to_123",
      firstName: "Ana",
      lastName: "Souza",
      dateOfBirth: "1990-03-15T00:00:00.000Z",
      taxId: "12345678909",
      phoneNumber: "+5511912345678",
      addressLine1: "Rua Augusta, 1200",
      addressLine2: "Apto 42",
      city: "São Paulo",
      stateProvinceRegion: "SP",
      postalCode: "01310100",
      country: "BR",
      idDocCountry: "BR",
      idDocType: "ID_CARD",
      idDocFrontFile: "https://files.blindpay.test/front",
      idDocBackFile: "https://files.blindpay.test/back",
      selfieFile: "https://files.blindpay.test/selfie",
    });
  });

  it("sends no complement when there is none, and no back for the passport", () => {
    const input = customerInput({
      form: { ...form, address: { ...form.address, complement: " " } },
      tosId: "to_123",
      documentType: "PASSPORT",
      files: { front: files.front, back: files.back, selfie: files.selfie },
    });
    expect(input).not.toBeNull();
    expect(input).not.toHaveProperty("addressLine2");
    expect(input).not.toHaveProperty("idDocBackFile");
    expect(documentSlots("PASSPORT")).toEqual(["front", "selfie"]);
    expect(documentSlots("ID_CARD")).toEqual(["front", "back", "selfie"]);
  });

  it("gives nothing while a passo or a file is missing", () => {
    expect(
      customerInput({ form: { ...form, phone: "" }, tosId: "t", documentType: "ID_CARD", files }),
    ).toBeNull();
    expect(
      customerInput({
        form,
        tosId: "t",
        documentType: "DRIVERS",
        files: { front: files.front, selfie: files.selfie },
      }),
    ).toBeNull();
  });
});
