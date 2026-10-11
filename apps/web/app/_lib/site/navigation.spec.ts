import { activeTab, footerColumns, showsSiteTabBar, siteTabs } from "./navigation";

describe("activeTab", () => {
  it.each([
    ["/", "home"],
    ["/me/tickets", "tickets"],
    ["/me/tickets/", "tickets"],
    ["/me/tickets/0b0c", "tickets"],
    ["/me", "account"],
    ["/me/", "account"],
    ["/e/festival-de-inverno", null],
    ["/checkout/abc", null],
    ["/me/ticketsx", null],
  ] as const)("%s → %s", (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });
});

describe("showsSiteTabBar", () => {
  it.each([
    ["/", true],
    ["/me", true],
    ["/me/", true],
    ["/me/tickets", true],
    ["/me/tickets/0b0c", false],
    ["/e/festival-de-inverno", false],
    ["/checkout/abc", false],
  ] as const)("%s → %s", (path, shown) => {
    expect(showsSiteTabBar(path)).toBe(shown);
  });
});

describe("siteTabs", () => {
  it("are Início, Ingressos and Conta (S4)", () => {
    expect(siteTabs.map(({ label, href }) => [label, href])).toEqual([
      ["Início", "/"],
      ["Ingressos", "/me/tickets"],
      ["Conta", "/me"],
    ]);
  });
});

describe("footerColumns", () => {
  it("only link places that exist or arrive before the validation (S16)", () => {
    expect(footerColumns).toEqual([
      { title: "Para você", links: [{ href: "/me/tickets", label: "Meus ingressos" }] },
      {
        title: "Para produtores",
        links: [
          { href: "/producer/start", label: "Vender ingressos" },
          { href: "/producer", label: "Painel do produtor" },
        ],
      },
    ]);
  });
});
