import { formatReais, parseReais } from "./money";

describe("parseReais", () => {
  it("reads the price as typed or as the field shows it", () => {
    expect(parseReais("60")).toBe(6000);
    expect(parseReais("60,00")).toBe(6000);
    expect(parseReais("R$ 60,00")).toBe(6000);
    expect(parseReais("R$ 60,5")).toBe(6050);
    expect(parseReais("1200,5")).toBe(120050);
    expect(parseReais("R$ 1.200,50")).toBe(120050);
    expect(parseReais("1.200")).toBe(120000);
    expect(parseReais("60.5")).toBe(6050);
    expect(parseReais("60,")).toBe(6000);
    expect(parseReais(" 0,01 ")).toBe(1);
  });

  it("is null when it is not an amount", () => {
    expect(parseReais("")).toBeNull();
    expect(parseReais("R$ ")).toBeNull();
    expect(parseReais("sessenta")).toBeNull();
    expect(parseReais("60,555")).toBeNull();
    expect(parseReais("1.20,50")).toBeNull();
    expect(parseReais("-60")).toBeNull();
    expect(parseReais("99999999999")).toBeNull();
  });
});

describe("formatReais", () => {
  it("shows cents as the price field does, and goes back to the same cents", () => {
    expect(formatReais(6000)).toBe("R$ 60,00");
    expect(formatReais(120050)).toBe("R$ 1.200,50");
    for (const cents of [1, 6000, 6050, 120050, 2_147_483_647]) {
      expect(parseReais(formatReais(cents))).toBe(cents);
    }
  });
});
