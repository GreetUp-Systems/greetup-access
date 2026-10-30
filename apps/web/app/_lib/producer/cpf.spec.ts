import { isValidCpf } from "./cpf";

describe("isValidCpf", () => {
  it("accepts a CPF whose two check digits are right, with or without the mask", () => {
    // Its first check digit comes out as 10, which counts as 0.
    expect(isValidCpf("123.456.789-09")).toBe(true);
    expect(isValidCpf("12345678909")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("refuses a wrong check digit (Seus dados · Erros: 123.456.789-00)", () => {
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidCpf("123.456.789-19")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("refuses one digit repeated, which passes the arithmetic", () => {
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("refuses anything that is not 11 digits", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("123.456.789-0")).toBe(false);
    expect(isValidCpf("123.456.789-091")).toBe(false);
  });
});
