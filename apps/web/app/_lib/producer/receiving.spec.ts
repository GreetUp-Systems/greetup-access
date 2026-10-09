import type { ProducerProfile } from "../api/producer";
import { receivingSummary } from "./receiving";

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "compliance_pending",
  compliance: { status: null, hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});

describe("receivingSummary", () => {
  it("asks to finish the setup before the verification starts", () => {
    expect(receivingSummary(producer())).toEqual({
      status: null,
      detail: "Termine a configuração para receber pelas vendas.",
      short: "Falta configurar",
    });
  });

  it("follows the verification: in review, rejected, approved while the account is released", () => {
    expect(
      receivingSummary(producer({ compliance: { status: "verifying", hasOpenRfi: false } })).status,
    ).toBe("in_review");
    expect(
      receivingSummary(producer({ compliance: { status: "rejected", hasOpenRfi: false } })).status,
    ).toBe("rejected");
    const releasing = receivingSummary(
      producer({
        onboardingStatus: "wallet_registration_pending",
        compliance: { status: "approved", hasOpenRfi: false },
      }),
    );
    expect(releasing).toEqual({
      status: "approved",
      detail: "Verificação aprovada. Liberando o recebimento…",
      short: "Liberando a conta…",
    });
  });

  it("shows the active account when the producer is ready", () => {
    expect(
      receivingSummary(
        producer({
          onboardingStatus: "ready",
          compliance: { status: "approved", hasOpenRfi: false },
        }),
      ),
    ).toEqual({
      status: "approved",
      detail: "Conta ativa e verificação aprovada.",
      short: "Conta ativa",
    });
  });

  it("puts an open request for information first, paused or not", () => {
    expect(
      receivingSummary(producer({ compliance: { status: "compliance_request", hasOpenRfi: true } }))
        .status,
    ).toBe("pending");
    expect(
      receivingSummary(
        producer({
          onboardingStatus: "ready",
          compliance: { status: "approved_rfi", hasOpenRfi: true },
        }),
      ),
    ).toEqual({
      status: "pending",
      detail: "A BlindPay pediu mais informações.",
      short: "Responder pedido",
    });
    // approved_rfi with the request already answered is just ready.
    expect(
      receivingSummary(
        producer({
          onboardingStatus: "ready",
          compliance: { status: "approved_rfi", hasOpenRfi: false },
        }),
      ).short,
    ).toBe("Conta ativa");
  });
});
