"use client";

import { TriangleAlert, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  type ReactNode,
  useId,
  useRef,
} from "react";

import { Button } from "@access/ui/components/button";
import { Progress } from "@access/ui/components/progress";
import { cn } from "@access/ui/lib/utils";

type CoverFieldState = "empty" | "uploading" | "sent" | "error";

type CoverFieldProps = Omit<ComponentProps<"div">, "onChange" | "onDragOver" | "onDrop"> & {
  /** Figma: Estado = Vazio · Enviando · Enviada · Erro. */
  state: CoverFieldState;
  /** The cover sent, shown in Enviada. */
  previewUrl?: string | null;
  /** Enviando: 0 to 100. */
  progress?: number;
  /** Erro: what to do, under "Não foi possível usar esta imagem". */
  errorDetail?: ReactNode;
  /** The picker's types (the input's `accept`); a dropped file skips it, so the caller checks it. */
  accept: string;
  /** A file chosen in the picker or dropped on the field. */
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

/** The round tile of the icon above the text, on the desktop only (378:21, 378:73). */
function Badge({ tone, children }: { tone: "accent" | "danger"; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "hidden rounded-full p-3 md:flex [&>svg]:size-icon-md",
        tone === "accent"
          ? "bg-bg-accent-subtle text-icon-accent"
          : "bg-bg-danger-subtle text-icon-danger",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Figma: Envio de capa (378:90), the event's 16:9 cover sent straight to Cloudflare R2. Vazio: a
 * dashed bg/subtle field, "Arraste a capa ou escolha um arquivo" with the formats and "Escolher
 * arquivo" (on the phone, "Escolha a imagem da capa", without the icon: 590:11793). Enviando: the
 * progress over a veil (378:42). Enviada: the cover, cut at the center, with "Trocar capa" (the
 * interface never removes a cover, SPEC-015 E7). Erro: bg/danger-subtle with border/danger, what to
 * do, and "Escolher outro arquivo". radius/lg. The input is hidden: the button is the control, and
 * on the desktop a file can be dropped on the field; the state is announced as it changes.
 */
function CoverField({
  state,
  previewUrl = null,
  progress = 0,
  errorDetail,
  accept,
  onFileSelect,
  disabled = false,
  className,
  ...props
}: CoverFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const takesFiles = state !== "uploading" && !disabled;
  const percent = Math.round(Math.min(100, Math.max(0, progress)));

  const choose = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again (after an error) is a new choice.
    event.target.value = "";
    if (file !== undefined) {
      onFileSelect(file);
    }
  };

  const dragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (takesFiles && event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>): void => {
    if (!takesFiles) {
      return;
    }
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file !== undefined) {
      onFileSelect(file);
    }
  };

  const pick = (label: string, icon?: ReactNode) => (
    <Button
      variant="secondary"
      size="s"
      disabled={disabled}
      aria-describedby={`${id}-status`}
      onClick={() => inputRef.current?.click()}
      iconLeft={icon}
    >
      {label}
    </Button>
  );

  return (
    <div
      data-slot="cover-field"
      data-state={state}
      className={cn(
        "relative flex aspect-video w-full min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg px-4 text-center",
        state === "empty" && "border border-dashed border-border-strong bg-bg-subtle",
        state === "error" && "border border-dashed border-border-danger bg-bg-danger-subtle",
        state === "sent" && "items-end justify-end p-4",
        className,
      )}
      onDragOver={dragOver}
      onDrop={drop}
      {...props}
    >
      {state === "empty" ? (
        <>
          <Badge tone="accent">
            <Upload />
          </Badge>
          <p className="type-body-m-strong text-text-primary">
            <span className="md:hidden">Escolha a imagem da capa</span>
            <span className="hidden md:inline">Arraste a capa ou escolha um arquivo</span>
          </p>
          <p className="type-body-s text-text-tertiary">
            JPG, PNG ou WebP até 5 MB, no formato 16:9 (pelo menos 1600 × 900)
          </p>
          <div className="mt-1">{pick("Escolher arquivo")}</div>
        </>
      ) : null}

      {state === "error" ? (
        <>
          <Badge tone="danger">
            <TriangleAlert />
          </Badge>
          <p className="type-body-m-strong text-text-primary">Não foi possível usar esta imagem</p>
          <p className="type-body-s text-text-secondary">{errorDetail}</p>
          <div className="mt-1">{pick("Escolher outro arquivo")}</div>
        </>
      ) : null}

      {state === "uploading" ? (
        <>
          <div aria-hidden className="absolute inset-0 bg-bg-canvas" />
          <div className="relative flex w-section-aside max-w-full flex-col items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
            <p className="type-body-m-strong text-text-primary">Enviando capa… {percent}%</p>
            <Progress value={percent} aria-label="Envio da capa" />
          </div>
        </>
      ) : null}

      {state === "sent" ? (
        <>
          {previewUrl === null ? null : (
            // The cover lives on R2 (D-30): a plain image, cut at the center as on the event page.
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 size-full rounded-lg object-cover"
            />
          )}
          <div className="relative">{pick("Trocar capa", <Upload />)}</div>
        </>
      ) : null}

      <span id={`${id}-status`} aria-live="polite" className="sr-only">
        {state === "sent"
          ? "Capa enviada."
          : state === "uploading"
            ? `Enviando capa, ${percent}%.`
            : state === "error"
              ? "Não foi possível usar esta imagem."
              : ""}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden
        disabled={!takesFiles}
        className="sr-only"
        onChange={choose}
      />
    </div>
  );
}

export { CoverField, type CoverFieldProps, type CoverFieldState };
