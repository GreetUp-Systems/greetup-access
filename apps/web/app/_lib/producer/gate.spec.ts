import { ApiError } from "../api/client";
import type { ProducerProfile } from "../api/producer";
import { failureRoute, isWaiting } from "./gate";

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "compliance_pending",
  compliance: { status: null, hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});

describe("failureRoute", () => {
  it("sends an account without a producer profile to Criar perfil", () => {
    expect(failureRoute(new ApiError(404, "producer_not_found", "", null))).toBe("create_profile");
  });

  it("sends an expired session back to the identification", () => {
    expect(failureRoute(new ApiError(401, "session_expired", "", null))).toBe("sign_in");
    expect(failureRoute(new ApiError(401, "invalid_auth_token", "", null))).toBe("sign_in");
  });

  it("offers a retry for anything else", () => {
    expect(failureRoute(new ApiError(0, "network_error", "", null))).toBe("failed");
    expect(failureRoute(new ApiError(503, "http_503", "", null))).toBe("failed");
    expect(failureRoute(new ApiError(404, "not_found", "", null))).toBe("failed");
    expect(failureRoute(new Error("boom"))).toBe("failed");
  });
});

describe("isWaiting", () => {
  it("re-reads while BlindPay analyses the data", () => {
    expect(isWaiting(producer({ compliance: { status: "verifying", hasOpenRfi: false } }))).toBe(
      true,
    );
  });

  it("re-reads while the receiving account is being prepared on the network", () => {
    expect(
      isWaiting(producer({ onboardingStatus: "stellar_pending", stellar: { status: "pending" } })),
    ).toBe(true);
    expect(
      isWaiting(
        producer({ onboardingStatus: "stellar_pending", stellar: { status: "submitted" } }),
      ),
    ).toBe(true);
  });

  it("re-reads while the BlindPay wallet is being registered", () => {
    expect(
      isWaiting(
        producer({
          onboardingStatus: "wallet_registration_pending",
          compliance: { status: "approved", hasOpenRfi: false },
        }),
      ),
    ).toBe(true);
  });

  it("does not re-read what waits on the producer, nor a ready producer", () => {
    expect(isWaiting(producer())).toBe(false);
    expect(isWaiting(producer({ compliance: { status: "rejected", hasOpenRfi: false } }))).toBe(
      false,
    );
    expect(
      isWaiting(producer({ compliance: { status: "compliance_request", hasOpenRfi: true } })),
    ).toBe(false);
    expect(
      isWaiting(producer({ onboardingStatus: "stellar_pending", stellar: { status: "signing" } })),
    ).toBe(false);
    expect(
      isWaiting(
        producer({
          onboardingStatus: "ready",
          compliance: { status: "approved_rfi", hasOpenRfi: true },
        }),
      ),
    ).toBe(false);
  });
});
