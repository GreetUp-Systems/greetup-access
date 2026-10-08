import { randomUUID } from "node:crypto";

/** Event cover rules (SPEC-015 E1, D-30): JPG, PNG or WebP up to 5 MB, uploaded straight to R2. */
export const coverContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type CoverContentType = (typeof coverContentTypes)[number];

export const coverMaxBytes = 5 * 1024 * 1024;
export const coverUploadExpiresInSeconds = 10 * 60;

const extensions: Record<CoverContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const keyPattern =
  /^events\/([0-9a-f-]{36})\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function newCoverKey(eventId: string, contentType: CoverContentType): string {
  return `events/${eventId}/${randomUUID()}.${extensions[contentType]}`;
}

/**
 * The content type a key was issued for, or null when the key is not a cover key of this event.
 * Only keys of the event itself are ever stored, deleted or checked in R2.
 */
export function coverKeyContentType(eventId: string, key: string): CoverContentType | null {
  const match = keyPattern.exec(key);
  if (match === null || match[1] !== eventId) {
    return null;
  }
  return coverContentTypes.find((type) => extensions[type] === match[2]) ?? null;
}

/** The uploaded object matches the type the URL was signed for and stays within the size limit. */
export function isAcceptedCover(
  expected: CoverContentType,
  stored: { contentType: string | null; size: number },
): boolean {
  const contentType = stored.contentType?.split(";")[0]?.trim().toLowerCase() ?? null;
  return contentType === expected && stored.size > 0 && stored.size <= coverMaxBytes;
}
