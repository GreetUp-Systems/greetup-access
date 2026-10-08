/** What the storage reports about an uploaded object, read before a cover is accepted. */
export interface StoredObject {
  contentType: string | null;
  size: number;
}

/** Event covers in object storage (D-30): the browser uploads directly with a presigned URL. */
export interface CoverStorage {
  /** A PUT URL valid for `expiresInSeconds`, bound to the given Content-Type. */
  presignUpload(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
  /** Null when the object does not exist. */
  head(key: string): Promise<StoredObject | null>;
  /** Deleting a missing object succeeds. */
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** Null when cover storage is off (development and tests without R2). */
export const COVER_STORAGE = Symbol("COVER_STORAGE");

export class CoverStorageError extends Error {
  constructor(readonly operation: "head" | "delete") {
    super(`Cover storage operation failed: ${operation}`);
    this.name = "CoverStorageError";
  }
}
