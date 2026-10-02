import { randomInt } from "node:crypto";

const maxBaseLength = 80;
const suffixLength = 6;
const suffixAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const fallbackSlug = "evento";

export const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxBaseLength)
    .replace(/-+$/g, "");

  return base.length > 0 ? base : fallbackSlug;
}

export function withRandomSuffix(base: string): string {
  let suffix = "";
  for (let index = 0; index < suffixLength; index += 1) {
    suffix += suffixAlphabet[randomInt(suffixAlphabet.length)];
  }
  return `${base}-${suffix}`;
}

// The unique index is the source of truth; callers try these in order and move on on conflict.
export function slugCandidates(name: string, attempts: number): string[] {
  const base = slugify(name);
  return [base, ...Array.from({ length: attempts - 1 }, () => withRandomSuffix(base))];
}
