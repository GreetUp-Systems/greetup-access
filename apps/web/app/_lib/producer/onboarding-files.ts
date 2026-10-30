/**
 * The API takes files up to 3 MB (SPEC-015 R5, SPEC-003 §8): BlindPay refused 5.2 MB, its own
 * limit being 5 MiB, so the browser shrinks the photos and keeps PDFs within this.
 */
export const MAX_ONBOARDING_FILE_BYTES = 3 * 1024 * 1024;

/** A document's side (front, back, the passport's photo page) or the selfie. */
export type OnboardingFileSlot = "document" | "selfie";

/** The picker's `accept`: documents in PDF, JPG or PNG; the selfie only a photo (SPEC-015 R8). */
export const onboardingFileAccept: Record<OnboardingFileSlot, string> = {
  document: "application/pdf,image/jpeg,image/png",
  selfie: "image/jpeg,image/png",
};

/**
 * Why a file is not sent, for the screen's message (SPEC-015 §6): a type outside the list, a PDF
 * above 3 MB, a photo the browser could not shrink to 3 MB, or an empty file.
 */
export type OnboardingFileRejection =
  "type_not_allowed" | "pdf_too_large" | "photo_unusable" | "empty";

export type OnboardingFileOutcome =
  | { status: "ready"; file: File; reduced: boolean }
  | { status: "rejected"; reason: OnboardingFileRejection };

/** A photo decoded upright (its orientation applied), which can be drawn again as JPEG. */
export interface DecodedPhoto {
  width: number;
  height: number;
  /** The photo at this size as JPEG, or null when the browser could not encode it. */
  encodeJpeg(width: number, height: number, quality: number): Promise<Blob | null>;
  release(): void;
}

export type DecodePhoto = (file: Blob) => Promise<DecodedPhoto>;

// The largest canvas Safari draws (4096 × 4096); bigger photos start below it.
const maxCanvasPixels = 16_777_216;
const jpegQuality = 0.9;
// Each try keeps 80% of the sides, about 64% of the bytes; the sixth is a third of the sides.
const sideStep = 0.8;
const maxTries = 6;

function fileKind(type: string): "pdf" | "photo" | null {
  if (type === "application/pdf") {
    return "pdf";
  }
  return type === "image/jpeg" || type === "image/png" ? "photo" : null;
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, "");
  return `${base === "" ? "foto" : base}.jpg`;
}

/**
 * A photo above 3 MB redrawn as JPEG, smaller each try, until it fits; null when it cannot be
 * decoded or drawn, or does not fit after the last try.
 */
export async function reducePhoto(file: File, decode: DecodePhoto): Promise<File | null> {
  let photo: DecodedPhoto;
  try {
    photo = await decode(file);
  } catch {
    return null;
  }
  try {
    let scale = Math.min(1, Math.sqrt(maxCanvasPixels / (photo.width * photo.height)));
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
      const width = Math.max(1, Math.floor(photo.width * scale));
      const height = Math.max(1, Math.floor(photo.height * scale));
      const jpeg = await photo.encodeJpeg(width, height, jpegQuality);
      if (jpeg === null) {
        return null;
      }
      if (jpeg.size > 0 && jpeg.size <= MAX_ONBOARDING_FILE_BYTES) {
        return new File([jpeg], jpegName(file.name), { type: "image/jpeg" });
      }
      scale *= sideStep;
    }
    return null;
  } catch {
    return null;
  } finally {
    photo.release();
  }
}

/**
 * Checks a chosen file before it is sent (SPEC-015 §6, R5, R8): the type for its slot, then the
 * size. A PDF goes up to 3 MB as it is; a photo above it is shrunk in the browser (`reduced`).
 */
export async function prepareOnboardingFile(
  file: File,
  slot: OnboardingFileSlot,
  decode: DecodePhoto = decodePhotoInBrowser,
): Promise<OnboardingFileOutcome> {
  const kind = fileKind(file.type);
  if (kind === null || (slot === "selfie" && kind === "pdf")) {
    return { status: "rejected", reason: "type_not_allowed" };
  }
  if (file.size === 0) {
    return { status: "rejected", reason: "empty" };
  }
  if (file.size <= MAX_ONBOARDING_FILE_BYTES) {
    return { status: "ready", file, reduced: false };
  }
  if (kind === "pdf") {
    return { status: "rejected", reason: "pdf_too_large" };
  }
  const reduced = await reducePhoto(file, decode);
  return reduced === null
    ? { status: "rejected", reason: "photo_unusable" }
    : { status: "ready", file: reduced, reduced: true };
}

/**
 * The browser's decoder: an <img>, which applies the photo's EXIF orientation, drawn on a canvas.
 * A JPEG has no transparency, so a PNG is drawn over white instead of the encoder's black.
 */
export async function decodePhotoInBrowser(file: Blob): Promise<DecodedPhoto> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    encodeJpeg: (width, height, quality) =>
      new Promise<Blob | null>((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (context === null) {
          resolve(null);
          return;
        }
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (jpeg) => {
            // Safari counts canvas memory per page: an emptied canvas gives it back at once.
            canvas.width = 0;
            canvas.height = 0;
            resolve(jpeg);
          },
          "image/jpeg",
          quality,
        );
      }),
    release: () => URL.revokeObjectURL(url),
  };
}
