import { type CoverStorage, type StoredObject } from "../src/common/storage/cover-storage.types";

/** R2 in memory. `upload` stands for the PUT the browser makes with the presigned URL. */
export class FakeCoverStorage implements CoverStorage {
  readonly publicBaseUrl = "https://covers.test";
  readonly objects = new Map<string, StoredObject>();
  readonly presigned: Array<{ key: string; contentType: string; expiresInSeconds: number }> = [];

  reset(): void {
    this.objects.clear();
    this.presigned.length = 0;
  }

  upload(key: string, contentType: string | null, size: number): void {
    this.objects.set(key, { contentType, size });
  }

  async presignUpload(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    this.presigned.push({ key, contentType, expiresInSeconds });
    return `https://r2.test/access-covers/${key}?X-Amz-Expires=${expiresInSeconds}`;
  }

  async head(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
