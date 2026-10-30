import { digitsOnly } from "./masks";

/** The check digit over the first `length` digits, with weights from `length + 1` down to 2. */
function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/**
 * A CPF the Receita Federal could have issued (SPEC-015 R8): 11 digits, both check digits right,
 * and not one digit repeated, which passes the arithmetic but is no CPF. The mask's dots and dash
 * are ignored.
 */
export function isValidCpf(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  return (
    checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10])
  );
}
