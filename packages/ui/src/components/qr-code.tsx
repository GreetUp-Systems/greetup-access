"use client";

import QRCode from "qrcode";
import { type ComponentProps, useMemo } from "react";

import { cn } from "@access/ui/lib/utils";

type QrCodeProps = Omit<ComponentProps<"svg">, "children"> & {
  /** What the code carries: the Pix copia e cola, or a ticket's QR token. */
  value: string;
  /** What a screen reader hears instead of the drawing. */
  label: string;
};

/**
 * Figma: QR Code inside the Pix plate (61:678). Drawn here, in the browser (SPEC-014 §7), as one
 * path of square modules in brand/midnight; the plate around it gives the quiet zone.
 */
function QrCode({ value, label, className, ...props }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let column = 0; column < modules.size; column += 1) {
        if (modules.get(row, column)) {
          d += `M${column} ${row}h1v1h-1z`;
        }
      }
    }
    return { size: modules.size, path: d };
  }, [value]);

  return (
    <svg
      data-slot="qr-code"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("text-(--palette-brand-midnight)", className)}
      {...props}
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export { QrCode };
