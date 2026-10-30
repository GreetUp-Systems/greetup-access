import { internationalPhone } from "./phone";

describe("internationalPhone", () => {
  it("sends a mobile as +55, DDD and number", () => {
    expect(internationalPhone("(11) 91234-5678")).toBe("+5511912345678");
    expect(internationalPhone("11912345678")).toBe("+5511912345678");
  });

  it("sends a landline as well", () => {
    expect(internationalPhone("(11) 2345-6789")).toBe("+551123456789");
    expect(internationalPhone("(48) 3025-1234")).toBe("+554830251234");
  });

  it("takes a number that already had the country code", () => {
    expect(internationalPhone("+55 11 91234-5678")).toBe("+5511912345678");
    expect(internationalPhone("+5511999999999")).toBe("+5511999999999");
  });

  it("refuses an incomplete number", () => {
    expect(internationalPhone("")).toBeNull();
    expect(internationalPhone("(11) 9123-456")).toBeNull();
    expect(internationalPhone("(11) 91234-567")).toBeNull();
  });

  it("refuses a DDD with a zero", () => {
    expect(internationalPhone("(01) 91234-5678")).toBeNull();
    expect(internationalPhone("(10) 91234-5678")).toBeNull();
  });

  it("refuses 11 digits that are not a mobile, and 10 that are not a landline", () => {
    expect(internationalPhone("(11) 81234-5678")).toBeNull();
    expect(internationalPhone("(11) 9123-4567")).toBeNull();
    expect(internationalPhone("(11) 1234-5678")).toBeNull();
  });
});
