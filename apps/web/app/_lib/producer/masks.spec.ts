import { digitsOnly, maskCep, maskCpf, maskDate, maskPhone, nationalPhoneDigits } from "./masks";

/** The field after each digit is typed, one by one. */
const typing = (mask: (value: string) => string, digits: string): string[] =>
  [...digits].map((_, index) => mask(digits.slice(0, index + 1)));

describe("digitsOnly", () => {
  it("keeps the digits of whatever came in", () => {
    expect(digitsOnly("123.456.789-09")).toBe("12345678909");
    expect(digitsOnly(" (11) 9 1234-5678 ")).toBe("11912345678");
    expect(digitsOnly("abc")).toBe("");
  });
});

describe("maskCpf", () => {
  it("formats the CPF as it is typed", () => {
    expect(typing(maskCpf, "12345678909")).toEqual([
      "1",
      "12",
      "123",
      "123.4",
      "123.45",
      "123.456",
      "123.456.7",
      "123.456.78",
      "123.456.789",
      "123.456.789-0",
      "123.456.789-09",
    ]);
  });

  it("takes a pasted CPF, formatted or not, and drops what comes after 11 digits", () => {
    expect(maskCpf("12345678909")).toBe("123.456.789-09");
    expect(maskCpf("123.456.789-09")).toBe("123.456.789-09");
    expect(maskCpf("123.456.789-0999")).toBe("123.456.789-09");
    expect(maskCpf("cpf: 123 456 789 09")).toBe("123.456.789-09");
    expect(maskCpf("")).toBe("");
  });

  it("drops the separator with the last digit when erasing", () => {
    expect(maskCpf("123.4")).toBe("123.4");
    expect(maskCpf("123.")).toBe("123");
  });
});

describe("maskCep", () => {
  it("formats the CEP as it is typed and when pasted", () => {
    expect(typing(maskCep, "01310100")).toEqual([
      "0",
      "01",
      "013",
      "0131",
      "01310",
      "01310-1",
      "01310-10",
      "01310-100",
    ]);
    expect(maskCep("01310-100")).toBe("01310-100");
    expect(maskCep("013101009")).toBe("01310-100");
  });
});

describe("maskDate", () => {
  it("formats DD/MM/AAAA as it is typed and when pasted", () => {
    expect(typing(maskDate, "15031990")).toEqual([
      "1",
      "15",
      "15/0",
      "15/03",
      "15/03/1",
      "15/03/19",
      "15/03/199",
      "15/03/1990",
    ]);
    expect(maskDate("15/03/1990")).toBe("15/03/1990");
    expect(maskDate("15-03-1990")).toBe("15/03/1990");
    expect(maskDate("150319901")).toBe("15/03/1990");
  });
});

describe("maskPhone", () => {
  it("formats a mobile as it is typed, moving the dash at the 11th digit", () => {
    expect(typing(maskPhone, "11912345678")).toEqual([
      "(1",
      "(11",
      "(11) 9",
      "(11) 91",
      "(11) 912",
      "(11) 9123",
      "(11) 9123-4",
      "(11) 9123-45",
      "(11) 9123-456",
      "(11) 9123-4567",
      "(11) 91234-5678",
    ]);
  });

  it("formats a landline with ten digits", () => {
    expect(maskPhone("1123456789")).toBe("(11) 2345-6789");
  });

  it("drops the country code the browser's autofill brings", () => {
    expect(maskPhone("+55 11 91234-5678")).toBe("(11) 91234-5678");
    expect(maskPhone("+5511912345678")).toBe("(11) 91234-5678");
    expect(maskPhone("+55 11 2345-6789")).toBe("(11) 2345-6789");
  });

  it("keeps DDD 55 (Rio Grande do Sul) when there is no country code", () => {
    expect(maskPhone("55991234567")).toBe("(55) 99123-4567");
    expect(maskPhone("+55 55 99123-4567")).toBe("(55) 99123-4567");
  });

  it("stops at 11 digits", () => {
    expect(maskPhone("119123456789")).toBe("(11) 91234-5678");
    expect(nationalPhoneDigits("(11) 91234-56789")).toBe("11912345678");
  });
});
