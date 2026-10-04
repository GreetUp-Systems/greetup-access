"use client";

import { LoaderCircle } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type MouseEvent, type ReactNode } from "react";

import styles from "./Button.module.css";

/** Figma: Botão/Primário, Secundário, Fantasma, Destrutivo and Inverso (page "Botão"). */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "inverse";

/** Figma: Tamanho S (36), M (44) and L (52). */
export type ButtonSize = "s" | "m" | "l";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Figma: Estado=Carregando. The spinner takes the left icon's place and clicks are ignored. */
  loading?: boolean;
  /** Figma: Ícone esquerdo. A lucide-react icon; size and color come from the button. */
  iconLeft?: ReactNode;
  /** Figma: Ícone direito. */
  iconRight?: ReactNode;
  children: ReactNode;
}

/**
 * Hover, focus and pressed are CSS states; disabled and loading are props (component map in
 * docs/design/component-map.md).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "m",
    loading = false,
    iconLeft,
    iconRight,
    className,
    children,
    onClick,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const leading = loading ? (
    <LoaderCircle className={styles.spinner} strokeWidth={1.75} aria-hidden />
  ) : (
    iconLeft
  );

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {leading !== undefined && leading !== null ? (
        <span className={styles.icon} aria-hidden>
          {leading}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {iconRight !== undefined && iconRight !== null ? (
        <span className={styles.icon} aria-hidden>
          {iconRight}
        </span>
      ) : null}
    </button>
  );
});
