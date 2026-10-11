import type { AccountView } from "../api/account";
import type { ProducerProfile } from "../api/producer";
import {
  accountInitials,
  accountMenuGroups,
  emailInitial,
  type ProducerLookup,
  siteAccount,
} from "./account";

const account: AccountView = {
  user: { id: "u1", email: "ana@email.com" },
  wallet: { address: `G${"A".repeat(55)}`, chainType: "stellar" },
};

const producer = (overrides: Partial<ProducerProfile> = {}): ProducerProfile => ({
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "ready",
  compliance: { status: "approved", hasOpenRfi: false },
  stellar: { status: "active" },
  ...overrides,
});

const loading: ProducerLookup = { status: "loading" };
const none: ProducerLookup = { status: "none" };

describe("siteAccount", () => {
  it("waits while the session is unknown", () => {
    expect(siteAccount({ status: "loading" }, loading)).toEqual({ kind: "loading" });
    expect(siteAccount({ status: "loading" }, none)).toEqual({ kind: "loading" });
  });

  it("is a visitor without a session", () => {
    expect(siteAccount({ status: "anonymous" }, loading)).toEqual({ kind: "visitor" });
  });

  it("knows the e-mail before the producer read answers", () => {
    expect(siteAccount({ status: "authenticated", account }, loading)).toEqual({
      kind: "member",
      email: "ana@email.com",
      profile: "loading",
    });
  });

  it("shows a buyer when there is no producer profile or the read failed (S18)", () => {
    expect(siteAccount({ status: "authenticated", account }, none)).toEqual({
      kind: "member",
      email: "ana@email.com",
      profile: "buyer",
    });
  });

  it("shows the public name of a producer, whatever the setup state", () => {
    for (const onboardingStatus of ["compliance_pending", "ready"] as const) {
      expect(
        siteAccount(
          { status: "authenticated", account },
          { status: "found", producer: producer({ onboardingStatus }) },
        ),
      ).toEqual({
        kind: "member",
        email: "ana@email.com",
        profile: { producerName: "Casa Fluida" },
      });
    }
  });
});

describe("emailInitial", () => {
  it.each([
    ["ana@email.com", "A"],
    ["Ana@Email.com", "A"],
    ["élida@email.com", "É"],
    ["çaroline@email.com", "Ç"],
    ["9lives@email.com", "9"],
    ["_ana.souza+teste@email.com", "A"],
    ["", ""],
  ])("%s → %s", (email, initial) => {
    expect(emailInitial(email)).toBe(initial);
  });
});

describe("accountInitials", () => {
  it("uses the e-mail for a buyer and the public name for a producer", () => {
    expect(accountInitials("ana@email.com", "buyer")).toBe("A");
    expect(accountInitials("voce@email.com", { producerName: "Casa Fluida" })).toBe("CF");
  });
});

describe("accountMenuGroups", () => {
  it("offers to start selling to a buyer", () => {
    expect(accountMenuGroups("buyer")).toEqual([
      [
        { href: "/me/tickets", label: "Meus ingressos" },
        { href: "/me", label: "Conta" },
      ],
      [{ href: "/producer/start", label: "Vender ingressos" }],
    ]);
  });

  it("leads a producer to the dashboard instead", () => {
    expect(accountMenuGroups({ producerName: "Casa Fluida" })).toEqual([
      [
        { href: "/me/tickets", label: "Meus ingressos" },
        { href: "/me", label: "Conta" },
      ],
      [{ href: "/producer", label: "Painel do produtor" }],
    ]);
  });
});
