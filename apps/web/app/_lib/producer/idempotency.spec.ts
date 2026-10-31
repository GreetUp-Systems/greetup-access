import { fileFingerprint, keyFor } from "./idempotency";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("keyFor", () => {
  it("makes a UUID for a new request", () => {
    const request = keyFor(null, "payload");
    expect(request.fingerprint).toBe("payload");
    expect(request.key).toMatch(uuidV4);
  });

  it("repeats the key for the same request, so a retry is the same submission", () => {
    const first = keyFor(null, '{"firstName":"Ana"}');
    expect(keyFor(first, '{"firstName":"Ana"}')).toBe(first);
  });

  it("makes a new key once the data or the files change", () => {
    const first = keyFor(undefined, '{"firstName":"Ana"}', () => "key-1");
    const second = keyFor(first, '{"firstName":"Ana Maria"}', () => "key-2");
    expect(second).toEqual({ fingerprint: '{"firstName":"Ana Maria"}', key: "key-2" });
  });
});

describe("fileFingerprint", () => {
  it("is the same for the same file chosen again, and differs for another file or row", () => {
    const file = new File(["front"], "rg-frente.jpg", { type: "image/jpeg", lastModified: 1 });
    const again = new File(["front"], "rg-frente.jpg", { type: "image/jpeg", lastModified: 1 });
    const other = new File(["other"], "rg-frente-2.jpg", { type: "image/jpeg", lastModified: 2 });
    expect(fileFingerprint("front", again)).toBe(fileFingerprint("front", file));
    expect(fileFingerprint("front", other)).not.toBe(fileFingerprint("front", file));
    expect(fileFingerprint("back", file)).not.toBe(fileFingerprint("front", file));
  });
});
