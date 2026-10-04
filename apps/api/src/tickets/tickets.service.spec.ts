import { ticketCode } from "./tickets.service";

describe("ticketCode", () => {
  it("prefixes the token id with AX- and pads it to four digits", () => {
    expect(ticketCode(42)).toBe("AX-0042");
    expect(ticketCode(0)).toBe("AX-0000");
    expect(ticketCode(12345)).toBe("AX-12345");
  });
});
