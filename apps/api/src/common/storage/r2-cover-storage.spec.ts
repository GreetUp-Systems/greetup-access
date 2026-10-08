import { randomBytes } from "node:crypto";

import { CoverStorageError } from "./cover-storage.types";
import { R2CoverStorage } from "./r2-cover-storage";

// Built at runtime: nothing in the repository looks like a credential.
const config = {
  accountId: randomBytes(16).toString("hex"),
  accessKeyId: randomBytes(16).toString("hex"),
  secretAccessKey: randomBytes(32).toString("hex"),
  bucket: "access-covers",
  publicBaseUrl: "https://covers.example.com",
};
const key = "events/00000000-0000-4000-8000-000000000010/00000000-0000-4000-8000-0000000000c1.png";

describe("R2CoverStorage", () => {
  const storage = new R2CoverStorage(config);
  let fetchMock: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("presigns a PUT on the bucket that binds the Content-Type and expires", async () => {
    const url = new URL(await storage.presignUpload(key, "image/png", 600));

    expect(url.origin).toBe(`https://${config.accountId}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe(`/access-covers/${key}`);
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(
      new RegExp(`^${config.accessKeyId}/\\d{8}/auto/s3/aws4_request$`),
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain(config.secretAccessKey);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs a different URL for another Content-Type at the same instant", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-08T12:00:00Z"), doNotFake: ["queueMicrotask"] });
    try {
      const png = new URL(await storage.presignUpload(key, "image/png", 600));
      const again = new URL(await storage.presignUpload(key, "image/png", 600));
      const jpeg = new URL(await storage.presignUpload(key, "image/jpeg", 600));

      expect(again.toString()).toBe(png.toString());
      expect(jpeg.searchParams.get("X-Amz-Signature")).not.toBe(
        png.searchParams.get("X-Amz-Signature"),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("reads type and size of an object, and null when it does not exist", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "2048" },
      }),
    );
    await expect(storage.head(key)).resolves.toEqual({ contentType: "image/png", size: 2048 });

    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.method).toBe("HEAD");
    expect(request.url).toBe(
      `https://${config.accountId}.r2.cloudflarestorage.com/access-covers/${key}`,
    );
    expect(request.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=/);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(storage.head(key)).resolves.toBeNull();
  });

  it("deletes an object and treats a missing one as deleted", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(storage.delete(key)).resolves.toBeUndefined();
    expect((fetchMock.mock.calls[0]![0] as Request).method).toBe("DELETE");

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it("reports refusals and network failures as storage errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(storage.head(key)).rejects.toBeInstanceOf(CoverStorageError);

    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(storage.delete(key)).rejects.toMatchObject({ operation: "delete" });
  });

  it("serves covers from the public origin", () => {
    expect(storage.publicUrl(key)).toBe(`https://covers.example.com/${key}`);
  });
});
