// The Idempotency-Key of the onboarding's mutations (SPEC-003 §8, SPEC-015 §6): the same request
// sent again keeps its key, so the API and BlindPay answer the first result instead of doing it
// twice; a request that changed (other data, other files) gets a new key. The API takes a UUID.

/** A request's key and what it was made for. */
export interface RequestKey {
  /** What identifies the request's content; kept only in the page's memory. */
  fingerprint: string;
  key: string;
}

const newUuid = (): string => crypto.randomUUID();

/** The key of a request: the previous one for the same content, a new one otherwise. */
export function keyFor(
  previous: RequestKey | null | undefined,
  fingerprint: string,
  newKey: () => string = newUuid,
): RequestKey {
  return previous !== null && previous !== undefined && previous.fingerprint === fingerprint
    ? previous
    : { fingerprint, key: newKey() };
}

/** A chosen file, as the browser describes it: choosing the same file again is the same upload. */
export function fileFingerprint(slot: string, file: File): string {
  return [slot, file.name, file.size, file.lastModified, file.type].join("\u0000");
}
