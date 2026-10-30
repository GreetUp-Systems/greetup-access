// Masks of Seus dados, applied as the producer types (SPEC-015 R8, R10): whatever comes in, typed,
// pasted or filled by the browser, is reduced to its digits and shown in the field's format.

/** Only the digits of a value. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Each group is [length, what comes before it]; a separator shows once its group starts. */
function format(digits: string, groups: ReadonlyArray<readonly [number, string]>): string {
  let formatted = "";
  let rest = digits;
  for (const [length, before] of groups) {
    if (rest === "") {
      break;
    }
    formatted += before + rest.slice(0, length);
    rest = rest.slice(length);
  }
  return formatted;
}

/** 000.000.000-00. */
export function maskCpf(value: string): string {
  return format(digitsOnly(value).slice(0, 11), [
    [3, ""],
    [3, "."],
    [3, "."],
    [2, "-"],
  ]);
}

/** 00000-000. */
export function maskCep(value: string): string {
  return format(digitsOnly(value).slice(0, 8), [
    [5, ""],
    [3, "-"],
  ]);
}

/** DD/MM/AAAA. */
export function maskDate(value: string): string {
  return format(digitsOnly(value).slice(0, 8), [
    [2, ""],
    [2, "/"],
    [4, "/"],
  ]);
}

/**
 * The national number of a Brazilian phone, DDD and number, at most 11 digits. The country code
 * the browser's autofill brings ("+55 11 91234-5678") is dropped: with it, the number has 12 or
 * 13 digits.
 */
export function nationalPhoneDigits(value: string): string {
  const digits = digitsOnly(value);
  const national = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return national.slice(0, 11);
}

/** (11) 91234-5678 for a mobile; (11) 2345-6789 while it has up to 10 digits, as a landline. */
export function maskPhone(value: string): string {
  const digits = nationalPhoneDigits(value);
  return format(digits, [
    [2, "("],
    [digits.length > 10 ? 5 : 4, ") "],
    [4, "-"],
  ]);
}
