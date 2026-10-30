import {
  type DecodedPhoto,
  type DecodePhoto,
  MAX_ONBOARDING_FILE_BYTES,
  onboardingFileAccept,
  prepareOnboardingFile,
  reducePhoto,
} from "./onboarding-files";

const megabyte = 1024 * 1024;

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

interface FakePhoto extends DecodedPhoto {
  encodeJpeg: jest.Mock<Promise<Blob | null>, [number, number, number]>;
  release: jest.Mock<void, []>;
}

/**
 * A decoder whose JPEG weighs `bytesPerPixel` per pixel drawn, so each try is smaller than the
 * one before; `encodeJpeg` and `release` are spies.
 */
function decoder(
  width: number,
  height: number,
  bytesPerPixel: number,
): { decode: jest.Mock<Promise<DecodedPhoto>, [Blob]>; photo: FakePhoto } {
  const photo: FakePhoto = {
    width,
    height,
    encodeJpeg: jest.fn<Promise<Blob | null>, [number, number, number]>((w, h) =>
      Promise.resolve(new Blob([new Uint8Array(Math.round(w * h * bytesPerPixel))])),
    ),
    release: jest.fn<void, []>(),
  };
  const decode = jest.fn<Promise<DecodedPhoto>, [Blob]>(() => Promise.resolve(photo));
  return { decode, photo };
}

const untouched: DecodePhoto = () => Promise.reject(new Error("the photo should not be decoded"));

describe("onboardingFileAccept", () => {
  it("offers PDF, JPG and PNG for a document and only a photo for the selfie", () => {
    expect(onboardingFileAccept.document).toBe("application/pdf,image/jpeg,image/png");
    expect(onboardingFileAccept.selfie).toBe("image/jpeg,image/png");
  });
});

describe("prepareOnboardingFile", () => {
  it("sends a document in PDF, JPG or PNG up to 3 MB as it is", async () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png"]) {
      const chosen = file("rg-frente", type, megabyte);
      await expect(prepareOnboardingFile(chosen, "document", untouched)).resolves.toEqual({
        status: "ready",
        file: chosen,
        reduced: false,
      });
    }
  });

  it("takes a file of exactly 3 MB", async () => {
    const chosen = file("rg.pdf", "application/pdf", MAX_ONBOARDING_FILE_BYTES);

    await expect(prepareOnboardingFile(chosen, "document", untouched)).resolves.toMatchObject({
      status: "ready",
      file: chosen,
    });
  });

  it("takes the selfie only as a photo", async () => {
    const photo = file("selfie.jpg", "image/jpeg", megabyte);

    await expect(prepareOnboardingFile(photo, "selfie", untouched)).resolves.toMatchObject({
      status: "ready",
    });
    await expect(
      prepareOnboardingFile(file("selfie.pdf", "application/pdf", megabyte), "selfie", untouched),
    ).resolves.toEqual({ status: "rejected", reason: "type_not_allowed" });
  });

  it("refuses any other type, the type unknown included", async () => {
    for (const type of ["image/heic", "image/gif", "image/webp", "text/plain", ""]) {
      await expect(
        prepareOnboardingFile(file("arquivo", type, megabyte), "document", untouched),
      ).resolves.toEqual({ status: "rejected", reason: "type_not_allowed" });
    }
  });

  it("refuses an empty file", async () => {
    await expect(
      prepareOnboardingFile(file("rg.pdf", "application/pdf", 0), "document", untouched),
    ).resolves.toEqual({ status: "rejected", reason: "empty" });
  });

  it("refuses a PDF above 3 MB, which the browser cannot shrink", async () => {
    await expect(
      prepareOnboardingFile(
        file("rg.pdf", "application/pdf", MAX_ONBOARDING_FILE_BYTES + 1),
        "document",
        untouched,
      ),
    ).resolves.toEqual({ status: "rejected", reason: "pdf_too_large" });
  });

  it("shrinks a photo above 3 MB into a JPEG that fits", async () => {
    // 4000 × 3000 at 0.3 bytes a pixel: 3.4 MB at full size, 2.2 MB at 80% of the sides.
    const { decode, photo } = decoder(4000, 3000, 0.3);
    const chosen = file("IMG_0042.PNG", "image/png", 5 * megabyte);

    const outcome = await prepareOnboardingFile(chosen, "document", decode);

    expect(outcome).toMatchObject({ status: "ready", reduced: true });
    const reduced = (outcome as { file: File }).file;
    expect(reduced.name).toBe("IMG_0042.jpg");
    expect(reduced.type).toBe("image/jpeg");
    expect(reduced.size).toBeLessThanOrEqual(MAX_ONBOARDING_FILE_BYTES);
    expect(decode).toHaveBeenCalledWith(chosen);
    expect(photo.encodeJpeg.mock.calls).toEqual([
      [4000, 3000, 0.9],
      [3200, 2400, 0.9],
    ]);
    expect(photo.release).toHaveBeenCalledTimes(1);
  });

  it("shrinks the selfie the same way", async () => {
    const { decode } = decoder(3000, 4000, 0.2);

    await expect(
      prepareOnboardingFile(file("selfie.jpg", "image/jpeg", 4 * megabyte), "selfie", decode),
    ).resolves.toMatchObject({ status: "ready", reduced: true });
  });

  it("refuses a photo the browser cannot decode or draw", async () => {
    const broken: DecodePhoto = () => Promise.reject(new Error("EncodingError"));
    await expect(
      prepareOnboardingFile(file("rg.jpg", "image/jpeg", 4 * megabyte), "document", broken),
    ).resolves.toEqual({ status: "rejected", reason: "photo_unusable" });

    const { decode, photo } = decoder(4000, 3000, 0.3);
    photo.encodeJpeg.mockResolvedValueOnce(null);
    await expect(
      prepareOnboardingFile(file("rg.jpg", "image/jpeg", 4 * megabyte), "document", decode),
    ).resolves.toEqual({ status: "rejected", reason: "photo_unusable" });
    expect(photo.release).toHaveBeenCalledTimes(1);
  });

  it("refuses a photo that does not fit after the last try", async () => {
    // So heavy that even a third of its sides is above 3 MB.
    const { decode, photo } = decoder(4000, 3000, 3);

    await expect(
      prepareOnboardingFile(file("rg.jpg", "image/jpeg", 9 * megabyte), "document", decode),
    ).resolves.toEqual({ status: "rejected", reason: "photo_unusable" });
    expect(photo.encodeJpeg).toHaveBeenCalledTimes(6);
    expect(photo.release).toHaveBeenCalledTimes(1);
  });
});

describe("reducePhoto", () => {
  it("starts a photo larger than Safari's canvas within its 16.7 million pixels", async () => {
    // 8064 × 6048, a 48-megapixel phone photo.
    const { decode, photo } = decoder(8064, 6048, 0.05);

    const reduced = await reducePhoto(file("IMG.jpg", "image/jpeg", 12 * megabyte), decode);

    expect(reduced).not.toBeNull();
    const [width, height] = photo.encodeJpeg.mock.calls[0]!;
    expect(width * height).toBeLessThanOrEqual(16_777_216);
    expect(width / height).toBeCloseTo(8064 / 6048, 2);
  });

  it("names a file without an extension as a JPEG too", async () => {
    const { decode } = decoder(2000, 2000, 0.5);

    const reduced = await reducePhoto(file("documento", "image/png", 4 * megabyte), decode);

    expect(reduced?.name).toBe("documento.jpg");
  });

  it("gives up when drawing throws, and still lets the photo go", async () => {
    const { decode, photo } = decoder(4000, 3000, 0.3);
    photo.encodeJpeg.mockRejectedValueOnce(new Error("canvas too large"));

    await expect(
      reducePhoto(file("rg.jpg", "image/jpeg", 4 * megabyte), decode),
    ).resolves.toBeNull();
    expect(photo.release).toHaveBeenCalledTimes(1);
  });
});
