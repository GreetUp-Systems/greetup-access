import {
  clearAcceptedTerms,
  isTermsUrl,
  readAcceptedTerms,
  storeAcceptedTerms,
  termsRedirectUrl,
  tosIdFrom,
} from "./terms";

/** The tab's sessionStorage, for a test that runs outside a browser. */
function sessionStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("the accepted terms in the tab", () => {
  const global = globalThis as { window?: unknown };

  beforeEach(() => {
    global.window = { sessionStorage: sessionStorageStub() };
  });

  afterEach(() => {
    delete global.window;
  });

  it("keeps the acceptance per producer until the submission takes it out", () => {
    expect(readAcceptedTerms("p1")).toBeNull();
    storeAcceptedTerms("p1", "to_abc123");
    expect(readAcceptedTerms("p1")).toBe("to_abc123");
    expect(readAcceptedTerms("p2")).toBeNull();
    clearAcceptedTerms("p1");
    expect(readAcceptedTerms("p1")).toBeNull();
  });

  it("works without the browser's storage: nothing is read", () => {
    global.window = {
      sessionStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(() => storeAcceptedTerms("p1", "to_abc123")).not.toThrow();
    expect(readAcceptedTerms("p1")).toBeNull();
    expect(() => clearAcceptedTerms("p1")).not.toThrow();
  });
});

describe("tosIdFrom", () => {
  it("takes BlindPay's id from the address and refuses anything else", () => {
    expect(tosIdFrom("to_3ZBXbQ9cK2")).toBe("to_3ZBXbQ9cK2");
    expect(tosIdFrom(" to_abc ")).toBe("to_abc");
    expect(tosIdFrom(null)).toBeNull();
    expect(tosIdFrom("")).toBeNull();
    expect(tosIdFrom("to_abc<script>")).toBeNull();
    expect(tosIdFrom("a".repeat(201))).toBeNull();
  });
});

describe("termsRedirectUrl and isTermsUrl", () => {
  it("brings the producer back to Seus dados on this origin", () => {
    expect(termsRedirectUrl("https://access.test")).toBe(
      "https://access.test/producer/receiving/data",
    );
    expect(termsRedirectUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/producer/receiving/data",
    );
  });

  it("opens BlindPay's page only on https", () => {
    expect(isTermsUrl("https://app.blindpay.com/e/terms-of-service")).toBe(true);
    expect(isTermsUrl("http://app.blindpay.com/terms")).toBe(false);
    expect(isTermsUrl("javascript:alert(1)")).toBe(false);
    expect(isTermsUrl("not a url")).toBe(false);
  });
});
