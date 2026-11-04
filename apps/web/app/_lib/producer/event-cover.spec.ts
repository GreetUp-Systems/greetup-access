import {
  checkCover,
  COVER_MAX_BYTES,
  coverContentType,
  coverProblemText,
  formatMegabytes,
} from "./event-cover";

const file = (name: string, type: string, size: number) => ({ name, type, size });

describe("checkCover", () => {
  it("takes a JPG, PNG or WebP up to 5 MB", () => {
    expect(checkCover(file("capa.jpg", "image/jpeg", 1_000))).toBeNull();
    expect(checkCover(file("capa.png", "image/png", COVER_MAX_BYTES))).toBeNull();
    expect(checkCover(file("capa.webp", "image/webp", 2_000_000))).toBeNull();
  });

  it("refuses another type, a file above 5 MB and an empty one", () => {
    expect(checkCover(file("capa.gif", "image/gif", 1_000))).toEqual({ kind: "type" });
    expect(checkCover(file("capa.pdf", "application/pdf", 1_000))).toEqual({ kind: "type" });
    expect(checkCover(file("capa.jpg", "image/jpeg", COVER_MAX_BYTES + 1))).toEqual({
      kind: "size",
      bytes: COVER_MAX_BYTES + 1,
    });
    expect(checkCover(file("capa.png", "image/png", 0))).toEqual({ kind: "refused" });
  });

  it("goes by the extension when the browser gives no type", () => {
    expect(coverContentType(file("capa.JPEG", "", 1))).toBe("image/jpeg");
    expect(coverContentType(file("capa.webp", "", 1))).toBe("image/webp");
    expect(coverContentType(file("capa", "", 1))).toBeNull();
    // A type the browser gave is the one that counts.
    expect(coverContentType(file("capa.png", "image/svg+xml", 1))).toBeNull();
  });
});

describe("coverProblemText", () => {
  it("says the size of a file too large (590:11903)", () => {
    expect(coverProblemText({ kind: "size", bytes: Math.round(8.4 * 1024 * 1024) })).toEqual({
      title: "Não foi possível usar esta imagem",
      detail: "O arquivo tem 8,4 MB. Envie JPG, PNG ou WebP até 5 MB.",
    });
  });

  it("says what is accepted for another type or an image refused", () => {
    const text = "Envie JPG, PNG ou WebP até 5 MB. Imagens fora de 16:9 são cortadas no centro.";
    expect(coverProblemText({ kind: "type" }).detail).toBe(text);
    expect(coverProblemText({ kind: "refused" }).detail).toBe(text);
  });

  it("rounds the size up, so a file just above the limit is never 5,0 MB", () => {
    expect(formatMegabytes(COVER_MAX_BYTES + 1)).toBe("5,1 MB");
    expect(formatMegabytes(12 * 1024 * 1024)).toBe("12,0 MB");
  });
});
