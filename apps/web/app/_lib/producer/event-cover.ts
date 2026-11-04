import type { CoverContentType } from "../api/producer-events";

// The event's cover in the browser (SPEC-015 E1, D-30): a JPG, PNG or WebP up to 5 MB, checked
// before asking for the URL; R2 and the API check it again before it counts.

export const COVER_MAX_BYTES = 5 * 1024 * 1024;

/** The picker's types (the input's `accept`); a dropped file is checked here all the same. */
export const coverAccept = "image/jpeg,image/png,image/webp";

const byExtension: Record<string, CoverContentType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** The type the upload is signed for: the file's, or its extension's when the browser gave none. */
export function coverContentType(file: { name: string; type: string }): CoverContentType | null {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
    return type;
  }
  if (type !== "") {
    return null;
  }
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  return byExtension[extension] ?? null;
}

/**
 * Why a cover is not in (Detalhes · 2 Capa · Erro no arquivo, 590:11903): a type outside the list,
 * a file above 5 MB (with its size), an empty one, or an image R2 or the API refused.
 */
export type CoverProblem = { kind: "type" } | { kind: "size"; bytes: number } | { kind: "refused" };

/** The browser's check of a chosen file; null when it can be sent. */
export function checkCover(file: {
  name: string;
  type: string;
  size: number;
}): CoverProblem | null {
  if (coverContentType(file) === null) {
    return { kind: "type" };
  }
  if (file.size > COVER_MAX_BYTES) {
    return { kind: "size", bytes: file.size };
  }
  return file.size === 0 ? { kind: "refused" } : null;
}

/** "8,4 MB", rounded up, so a file just above the limit never reads as 5,0 MB. */
export function formatMegabytes(bytes: number): string {
  // Tenths of a MB, rounded up; the epsilon keeps an exact tenth from going up by a float's noise.
  const megabytes = Math.ceil((bytes * 10) / (1024 * 1024) - 1e-9) / 10;
  return `${megabytes.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

/** The texts of Envio de capa in the error state (Figma 378:72 and 590:11903). */
export function coverProblemText(problem: CoverProblem): { title: string; detail: string } {
  const title = "Não foi possível usar esta imagem";
  if (problem.kind === "size") {
    return {
      title,
      detail: `O arquivo tem ${formatMegabytes(problem.bytes)}. Envie JPG, PNG ou WebP até 5 MB.`,
    };
  }
  return {
    title,
    detail: "Envie JPG, PNG ou WebP até 5 MB. Imagens fora de 16:9 são cortadas no centro.",
  };
}
