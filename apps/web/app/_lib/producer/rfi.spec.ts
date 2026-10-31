import type { OpenRfi, RfiField } from "../api/onboarding";
import {
  emptyRfiDraft,
  resolveRfiRoute,
  rfiAnswersBody,
  type RfiDraft,
  rfiFieldKind,
  rfiFieldProblem,
  rfiHref,
  rfiPassoOf,
  rfiProblemMessage,
  rfiQuestionCount,
  rfiSectionProblems,
  rfiSectionsDone,
} from "./rfi";

// The request of the Figma screens (Pendência · Pergunta 1 to 3 de 3), as BlindPay sends it.
const typeField: RfiField = {
  key: "proof_of_address_doc_type",
  label: "Proof of address type",
  required: true,
  items: [
    { label: "Utility bill", value: "UTILITY_BILL" },
    { label: "Bank statement", value: "BANK_STATEMENT" },
  ],
};
const fileField: RfiField = {
  key: "proof_of_address_doc_file",
  label: "Proof of address file",
  required: true,
  regex: "^https://[^\\s]+$",
};
const fundsField: RfiField = {
  key: "source_of_funds_description",
  label: "Source of funds description",
  required: true,
};
const websiteField: RfiField = {
  key: "website",
  label: "Website",
  required: true,
  regex: "^https://",
};
const noteField: RfiField = { key: "note", label: "Note", required: false };

const rfi: OpenRfi = {
  id: "rfi_1",
  status: "pending",
  request: [
    {
      title: "Proof of address",
      description: "The proof of address attached doesn't match the address provided.",
      fields: [typeField, fileField],
    },
    {
      title: "Source of funds",
      description: "Where does the money come from?",
      fields: [fundsField],
    },
    {
      title: "Website",
      description: "It must start with https://",
      fields: [websiteField, noteField],
    },
  ],
  expiresAt: "2026-11-03T15:00:00.000Z",
  createdAt: "2026-10-07T15:00:00.000Z",
};

const draft = (values: Record<string, string> = {}, files: RfiDraft["files"] = {}): RfiDraft => ({
  values,
  files,
});
const sentFile = { name: "fatura-agosto.pdf", fileUrl: "https://files.blindpay.com/fatura.pdf" };

describe("rfiHref", () => {
  it("gives each question its address, with ?passo from the second", () => {
    expect(rfiHref()).toBe("/producer/receiving/rfi");
    expect(rfiHref(1)).toBe("/producer/receiving/rfi");
    expect(rfiHref(3)).toBe("/producer/receiving/rfi?passo=3");
  });
});

describe("rfiFieldKind", () => {
  it("maps a field with items to the list, a file key or multiple to a file, the rest to text", () => {
    expect(rfiFieldKind(typeField)).toBe("list");
    expect(rfiFieldKind(fileField)).toBe("file");
    expect(rfiFieldKind({ key: "bank_statements_files", label: "", required: true })).toBe("file");
    expect(rfiFieldKind({ key: "evidence", label: "", required: true, multiple: true })).toBe(
      "file",
    );
    expect(rfiFieldKind(fundsField)).toBe("text");
    // "_file" must end the key: a text about files is still text.
    expect(rfiFieldKind({ key: "file_explanation", label: "", required: true })).toBe("text");
  });
});

describe("rfiFieldProblem", () => {
  it("asks for a required field left empty, spaces included, and lets an optional one go", () => {
    expect(rfiFieldProblem(fundsField, emptyRfiDraft)).toBe("required");
    expect(rfiFieldProblem(fundsField, draft({ source_of_funds_description: "   " }))).toBe(
      "required",
    );
    expect(rfiFieldProblem(noteField, emptyRfiDraft)).toBeNull();
    expect(rfiFieldProblem(fileField, emptyRfiDraft)).toBe("required");
  });

  it("checks the request's own pattern, on the text and on the file's URL", () => {
    expect(rfiFieldProblem(websiteField, draft({ website: "casafluida.com.br" }))).toBe("format");
    expect(rfiFieldProblem(websiteField, draft({ website: " https://casafluida.com.br " }))).toBe(
      null,
    );
    expect(rfiFieldProblem(fileField, draft({}, { [fileField.key]: sentFile }))).toBeNull();
    expect(
      rfiFieldProblem(
        fileField,
        draft({}, { [fileField.key]: { name: "a.pdf", fileUrl: "http://insecure/a.pdf" } }),
      ),
    ).toBe("format");
  });

  it("only takes a value of the list", () => {
    expect(rfiFieldProblem(typeField, draft({ [typeField.key]: "UTILITY_BILL" }))).toBeNull();
    expect(rfiFieldProblem(typeField, draft({ [typeField.key]: "PASSPORT" }))).toBe("required");
  });

  it("leaves a pattern that does not compile to the API", () => {
    const broken: RfiField = { key: "code", label: "Code", required: true, regex: "([a-z" };
    expect(rfiFieldProblem(broken, draft({ code: "anything" }))).toBeNull();
  });

  it("says how to correct each problem", () => {
    expect(rfiProblemMessage("required")).toBe("Preencha este campo.");
    expect(rfiProblemMessage("format")).toBe("Confira o formato pedido na mensagem acima.");
  });
});

describe("the sections", () => {
  const complete = draft(
    {
      [typeField.key]: "UTILITY_BILL",
      [fundsField.key]: "Venda de ingressos dos eventos",
      [websiteField.key]: "https://casafluida.com.br",
    },
    { [fileField.key]: sentFile },
  );

  it("lists the problems of one section by key", () => {
    expect(rfiSectionProblems(rfi.request[0]!, emptyRfiDraft)).toEqual({
      [typeField.key]: "required",
      [fileField.key]: "required",
    });
    expect(rfiSectionProblems(rfi.request[0]!, complete)).toEqual({});
  });

  it("counts the sections answered in a row from the first", () => {
    expect(rfiSectionsDone(rfi, emptyRfiDraft)).toBe(0);
    expect(rfiSectionsDone(rfi, draft({ [fundsField.key]: "Vendas" }))).toBe(0);
    expect(rfiSectionsDone(rfi, complete)).toBe(3);
    expect(
      rfiSectionsDone(rfi, draft({ ...complete.values, website: "casafluida" }, complete.files)),
    ).toBe(2);
  });

  it("finds the question of a field, and a request without sections still has one", () => {
    expect(rfiPassoOf(rfi, fundsField.key)).toBe(2);
    expect(rfiPassoOf(rfi, "unknown")).toBeNull();
    expect(rfiQuestionCount(rfi)).toBe(3);
    expect(rfiQuestionCount({ ...rfi, request: [] })).toBe(1);
  });
});

describe("rfiAnswersBody", () => {
  it("sends each field by its key, trimmed, and leaves an empty optional one out", () => {
    const body = rfiAnswersBody(
      rfi,
      draft(
        {
          [typeField.key]: "UTILITY_BILL",
          [fundsField.key]: "  Venda de ingressos  ",
          [websiteField.key]: "https://casafluida.com.br",
          [noteField.key]: "  ",
        },
        { [fileField.key]: sentFile },
      ),
    );
    expect(body).toEqual({
      proof_of_address_doc_type: "UTILITY_BILL",
      proof_of_address_doc_file: sentFile.fileUrl,
      source_of_funds_description: "Venda de ingressos",
      website: "https://casafluida.com.br",
    });
  });

  it("sends a list for a field with multiple", () => {
    const many: OpenRfi = {
      ...rfi,
      request: [
        {
          title: "Statements",
          description: "",
          fields: [{ key: "bank_statements_files", label: "", required: true, multiple: true }],
        },
      ],
    };
    expect(
      rfiAnswersBody(many, draft({}, { bank_statements_files: { name: "a.pdf", fileUrl: "u" } })),
    ).toEqual({ bank_statements_files: ["u"] });
  });

  it("ignores what was typed for a key the request does not have", () => {
    expect(rfiAnswersBody(rfi, draft({ injected: "x" }))).toEqual({});
  });
});

describe("resolveRfiRoute", () => {
  it("shows a question once the ones before it were answered", () => {
    expect(resolveRfiRoute(3, 0, 1)).toEqual({ kind: "show", passo: 1 });
    expect(resolveRfiRoute(3, 1, 2)).toEqual({ kind: "show", passo: 2 });
    expect(resolveRfiRoute(3, 3, 3)).toEqual({ kind: "show", passo: 3 });
    expect(resolveRfiRoute(3, 3, 1)).toEqual({ kind: "show", passo: 1 });
  });

  it("leads a question not open yet to the first one still to answer", () => {
    expect(resolveRfiRoute(3, 0, 3)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/rfi",
    });
    expect(resolveRfiRoute(3, 1, 3)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/rfi?passo=2",
    });
    expect(resolveRfiRoute(3, 3, 9)).toEqual({
      kind: "redirect",
      href: "/producer/receiving/rfi?passo=3",
    });
  });
});
