import horizontal from "@access/ui/assets/logo-horizontal.svg";
import symbol from "@access/ui/assets/logo-symbol.svg";

/** Figma: Logo (3:95), Versão = Principal. The SVGs are exported from Figma by the node's bounds. */
type LogoFormat = "horizontal" | "symbol";

interface LogoProps {
  format?: LogoFormat;
  /** Rendered height; the width follows the asset. The top bars and the desktop nav use 29. */
  height?: number;
  className?: string;
}

const assets = { horizontal, symbol } as const;

function Logo({ format = "horizontal", height = 29, className }: LogoProps) {
  const asset = assets[format];
  return (
    <img
      src={asset.src}
      width={Math.round((asset.width * height) / asset.height)}
      height={height}
      alt="Access"
      draggable={false}
      className={className}
    />
  );
}

export { Logo, type LogoFormat, type LogoProps };
