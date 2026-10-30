import { ApiError } from "../api/client";
import {
  fileProblemFromCheck,
  fileProblemFromUpload,
  fileProblemMessage,
  profileProblem,
  submissionProblem,
} from "./receiving-errors";

const api = (status: number, code: string): ApiError => new ApiError(status, code, "", null);

describe("profileProblem (POST /producers)", () => {
  it("maps each answer to Criar perfil's states", () => {
    expect(profileProblem(api(400, "invalid_producer_profile"))).toBe("invalid_name");
    expect(profileProblem(api(409, "producer_already_exists"))).toBe("exists");
    expect(profileProblem(api(401, "invalid_auth_token"))).toBe("signed_out");
    expect(profileProblem(api(0, "network_error"))).toBe("failed");
    expect(profileProblem(api(503, "http_503"))).toBe("failed");
    expect(profileProblem(api(500, "http_500"))).toBe("failed");
    expect(profileProblem(new Error("unexpected"))).toBe("failed");
  });
});

describe("the files of Documentos (POST .../files)", () => {
  it("turns the browser's checks into the row's error", () => {
    expect(fileProblemFromCheck("type_not_allowed")).toBe("type_not_allowed");
    expect(fileProblemFromCheck("pdf_too_large")).toBe("pdf_too_large");
    expect(fileProblemFromCheck("photo_unusable")).toBe("photo_unusable");
    expect(fileProblemFromCheck("empty")).toBe("unusable");
  });

  it("turns the API's answers into the row's error", () => {
    expect(fileProblemFromUpload(api(413, "http_413"))).toBe("pdf_too_large");
    expect(fileProblemFromUpload(api(400, "invalid_onboarding_file"))).toBe("unusable");
    expect(fileProblemFromUpload(api(422, "document_upload_failed"))).toBe("refused");
    expect(fileProblemFromUpload(api(503, "compliance_provider_unavailable"))).toBe("failed");
    expect(fileProblemFromUpload(api(0, "network_error"))).toBe("failed");
  });

  it("says each error with the Figma's text", () => {
    expect(fileProblemMessage("type_not_allowed", "selfie")).toBe(
      "A selfie precisa ser uma foto em JPG ou PNG.",
    );
    expect(fileProblemMessage("type_not_allowed", "document")).toBe(
      "O documento precisa ser PDF, JPG ou PNG.",
    );
    expect(fileProblemMessage("pdf_too_large", "document")).toBe(
      "PDF maior que 3 MB. Escolha outro arquivo.",
    );
    expect(fileProblemMessage("photo_unusable", "selfie")).toBe(
      "Não deu para usar esta foto. Escolha outra.",
    );
    expect(fileProblemMessage("unusable", "document")).toBe(
      "Não deu para usar este arquivo. Escolha outro.",
    );
    expect(fileProblemMessage("refused", "document")).toBe(
      "A BlindPay não aceitou este arquivo. Escolha outro.",
    );
    expect(fileProblemMessage("failed", "document")).toBe(
      "Não deu para enviar o arquivo. Tente de novo.",
    );
  });
});

describe("submissionProblem (POST .../customer)", () => {
  it("tells an earlier submission in progress from a refusal and a failure", () => {
    expect(submissionProblem(api(409, "customer_attempt_already_active"))).toBe("busy");
    expect(submissionProblem(api(422, "customer_creation_failed"))).toBe("refused");
    expect(submissionProblem(api(422, "customer_attempt_failed"))).toBe("refused");
    expect(submissionProblem(api(400, "invalid_onboarding_input"))).toBe("refused");
    expect(submissionProblem(api(503, "compliance_provider_unavailable"))).toBe("failed");
    expect(submissionProblem(api(0, "network_error"))).toBe("failed");
    expect(submissionProblem(api(409, "something_else"))).toBe("failed");
  });
});
