import { nationalPhoneDigits } from "./masks";

// The DDD (two digits, neither 0) and the number: a mobile has nine digits starting with 9, a
// landline eight starting with 2 to 5 (Anatel's numbering plan).
const mobile = /^[1-9]{2}9\d{8}$/;
const landline = /^[1-9]{2}[2-5]\d{7}$/;

/**
 * The phone in the international format BlindPay takes (SPEC-015 R8), "+5511912345678", or null
 * when the digits typed are not a Brazilian phone. Takes the masked field as it is.
 */
export function internationalPhone(value: string): string | null {
  const national = nationalPhoneDigits(value);
  return mobile.test(national) || landline.test(national) ? `+55${national}` : null;
}
