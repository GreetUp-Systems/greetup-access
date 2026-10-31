import { ActivationUnconfirmedError, SignatureRequiredError } from "../account-activation";
import { ApiError } from "../api/client";
import type { ProducerProfile } from "../api/producer";
import {
  afterRun,
  classifyResumeFailure,
  initialResumeState,
  nextResume,
  RESUME_ATTEMPTS,
  RESUME_RETRY_MS,
  type ResumeState,
  resumeMode,
} from "./account-resume";

const producer = (
  stellar: ProducerProfile["stellar"]["status"],
  onboardingStatus: ProducerProfile["onboardingStatus"] = "stellar_pending",
): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus,
  compliance: { status: null, hasOpenRfi: false },
  stellar: { status: stellar },
});

const passing = new ApiError(503, "stellar_unavailable", "", null);
const now = 1_000_000;

describe("resumeMode (R6)", () => {
  it("never touches an account that failed: only Tentar de novo does (R3)", () => {
    expect(resumeMode(producer("failed"), false)).toBeNull();
    expect(resumeMode(producer("failed"), true)).toBeNull();
  });

  it("follows a submitted transaction and registers the wallet anywhere, without the wallet", () => {
    expect(resumeMode(producer("submitted"), false)).toBe("resume");
    expect(resumeMode(producer("submitted"), true)).toBe("resume");
    expect(resumeMode(producer("active", "wallet_registration_pending"), false)).toBe("resume");
    expect(resumeMode(producer("active", "wallet_registration_pending"), true)).toBe("resume");
  });

  it("prepares a pending account without signing outside the Recebimento", () => {
    expect(resumeMode(producer("pending"), false)).toBe("resume");
  });

  it("leaves the signature to the Recebimento, which asks for it", () => {
    expect(resumeMode(producer("signing"), false)).toBeNull();
    expect(resumeMode(producer("not_started"), false)).toBeNull();
    expect(resumeMode(producer("signing"), true)).toBe("sign");
    expect(resumeMode(producer("not_started"), true)).toBe("sign");
    expect(resumeMode(producer("pending"), true)).toBe("sign");
  });

  it("has nothing to do once the account is active and the wallet registered", () => {
    expect(resumeMode(producer("active", "compliance_pending"), true)).toBeNull();
    expect(resumeMode(producer("active", "ready"), false)).toBeNull();
  });
});

describe("classifyResumeFailure", () => {
  it("tries again the network, 503 and other 5xx, the wallet and an unconfirmed transaction", () => {
    expect(classifyResumeFailure(new ApiError(0, "network_error", "", null))).toBe("passing");
    expect(classifyResumeFailure(passing)).toBe("passing");
    expect(
      classifyResumeFailure(new ApiError(503, "blindpay_wallet_registration_failed", "", null)),
    ).toBe("passing");
    expect(classifyResumeFailure(new ApiError(500, "http_500", "", null))).toBe("passing");
    expect(
      classifyResumeFailure(
        new ActivationUnconfirmedError({ status: "submitted", transactionHash: null }),
      ),
    ).toBe("passing");
    expect(classifyResumeFailure(new Error("user closed the wallet"))).toBe("passing");
  });

  it("stops at a definitive failure", () => {
    expect(classifyResumeFailure(new ApiError(502, "stellar_activation_failed", "", null))).toBe(
      "definitive",
    );
    expect(
      classifyResumeFailure(new ApiError(502, "blindpay_wallet_registration_failed", "", null)),
    ).toBe("definitive");
    expect(classifyResumeFailure(new ApiError(401, "invalid_auth_token", "", null))).toBe(
      "definitive",
    );
    expect(
      classifyResumeFailure(new ApiError(409, "stellar_wallet_owner_mismatch", "", null)),
    ).toBe("definitive");
  });

  it("does not count a missing signature as a failure", () => {
    expect(classifyResumeFailure(new SignatureRequiredError())).toBe("signature_required");
  });
});

describe("the limit of tries", () => {
  it(`stops after ${RESUME_ATTEMPTS} passing failures in a row, waiting between them`, () => {
    let state: ResumeState = initialResumeState;
    for (let attempt = 1; attempt < RESUME_ATTEMPTS; attempt += 1) {
      state = afterRun(state, { ok: false, error: passing }, now);
      expect(state).toEqual({
        failures: attempt,
        notBefore: now + RESUME_RETRY_MS,
        stoppedBy: null,
      });
      expect(nextResume(producer("submitted"), false, state, now)).toEqual({
        mode: "resume",
        delayMs: RESUME_RETRY_MS,
      });
    }
    state = afterRun(state, { ok: false, error: passing }, now);
    expect(state.stoppedBy).toEqual({ error: passing });
    expect(nextResume(producer("submitted"), false, state, now)).toBeNull();
  });

  it("stops at once at a definitive failure", () => {
    const failure = new ApiError(502, "blindpay_wallet_registration_failed", "", null);
    const state = afterRun(initialResumeState, { ok: false, error: failure }, now);
    expect(state.stoppedBy).toEqual({ error: failure });
    expect(
      nextResume(producer("active", "wallet_registration_pending"), false, state, now),
    ).toBeNull();
  });

  it("starts the count again after a run that went through", () => {
    const failed = afterRun(initialResumeState, { ok: false, error: passing }, now);
    const done = afterRun(failed, { ok: true }, now);
    expect(done).toEqual({ failures: 0, notBefore: now + RESUME_RETRY_MS, stoppedBy: null });
  });

  it("asks for the signature at once on the Recebimento when the resume reached it", () => {
    const state = afterRun(
      initialResumeState,
      { ok: false, error: new SignatureRequiredError() },
      now,
    );
    expect(state).toEqual({ failures: 0, notBefore: now, stoppedBy: null });
    expect(nextResume(producer("signing"), true, state, now)).toEqual({
      mode: "sign",
      delayMs: 0,
    });
    expect(nextResume(producer("signing"), false, state, now)).toBeNull();
  });

  it("waits only what is left of the pause", () => {
    const state: ResumeState = { failures: 1, notBefore: now + 4_000, stoppedBy: null };
    expect(nextResume(producer("pending"), false, state, now)).toEqual({
      mode: "resume",
      delayMs: 4_000,
    });
    expect(nextResume(producer("pending"), false, state, now + 9_000)).toEqual({
      mode: "resume",
      delayMs: 0,
    });
  });
});
