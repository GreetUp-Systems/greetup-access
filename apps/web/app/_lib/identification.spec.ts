import { classifyLoginError, formatCountdown, isValidEmail, normalizeCode } from "./identification";

describe("isValidEmail", () => {
  it("accepts an address with surrounding spaces", () => {
    expect(isValidEmail("  voce@email.com ")).toBe(true);
  });

  it.each(["", "voce", "voce@", "voce@email", "voce @email.com", "@email.com"])(
    "rejects %p",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});

describe("normalizeCode", () => {
  it("keeps digits only, at most six", () => {
    expect(normalizeCode("48 29-15")).toBe("482915");
    expect(normalizeCode("4829157")).toBe("482915");
    expect(normalizeCode("abc")).toBe("");
  });
});

describe("formatCountdown", () => {
  it("formats minutes and padded seconds, rounding up", () => {
    expect(formatCountdown(60_000)).toBe("1:00");
    expect(formatCountdown(41_200)).toBe("0:42");
    expect(formatCountdown(5_000)).toBe("0:05");
  });

  it("never goes below zero", () => {
    expect(formatCountdown(-3_000)).toBe("0:00");
  });
});

describe("classifyLoginError", () => {
  it("treats rejected credentials as a wrong code", () => {
    expect(classifyLoginError({ privyErrorCode: "invalid_credentials" })).toBe("wrong_code");
    expect(classifyLoginError({ privyErrorCode: "invalid_data" })).toBe("wrong_code");
  });

  it("treats rate limits, timeouts and unknown errors as a service failure", () => {
    expect(classifyLoginError({ privyErrorCode: "too_many_requests" })).toBe("service");
    expect(classifyLoginError(new TypeError("Failed to fetch"))).toBe("service");
    expect(classifyLoginError(null)).toBe("service");
  });
});
