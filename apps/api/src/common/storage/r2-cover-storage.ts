import { type CoverStorageConfig } from "@access/config";
import { AwsClient } from "aws4fetch";

import { type CoverStorage, CoverStorageError, type StoredObject } from "./cover-storage.types";

const requestTimeoutMs = 5_000;

/** Cloudflare R2 through its S3-compatible API, signed with SigV4 (D-30). */
export class R2CoverStorage implements CoverStorage {
  private readonly client: AwsClient;
  private readonly bucketUrl: string;

  constructor(private readonly config: CoverStorageConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
      retries: 1,
    });
    this.bucketUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  async presignUpload(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    // aws4fetch leaves Content-Type out of the signature unless every header is signed; signing it
    // makes R2 refuse an upload with any other type.
    const signed = await this.client.sign(
      new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }),
      { aws: { signQuery: true, allHeaders: true } },
    );
    return signed.url;
  }

  async head(key: string): Promise<StoredObject | null> {
    const response = await this.request(key, "HEAD", "head");
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new CoverStorageError("head");
    }
    const size = Number(response.headers.get("content-length"));
    return {
      contentType: response.headers.get("content-type"),
      size: Number.isFinite(size) ? size : 0,
    };
  }

  async delete(key: string): Promise<void> {
    const response = await this.request(key, "DELETE", "delete");
    if (!response.ok && response.status !== 404) {
      throw new CoverStorageError("delete");
    }
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl}/${key}`;
  }

  private async request(
    key: string,
    method: "HEAD" | "DELETE",
    operation: CoverStorageError["operation"],
  ): Promise<Response> {
    try {
      return await this.client.fetch(this.objectUrl(key), {
        method,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new CoverStorageError(operation);
    }
  }

  private objectUrl(key: string): string {
    return `${this.bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
