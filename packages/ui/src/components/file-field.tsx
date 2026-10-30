"use client";

import { CircleCheck, LoaderCircle, TriangleAlert, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  type ReactNode,
  useId,
  useRef,
} from "react";

import { Button } from "@access/ui/components/button";
import { cn } from "@access/ui/lib/utils";

type FileFieldState = "empty" | "uploading" | "sent" | "error";

type FileFieldProps = Omit<
  ComponentProps<"div">,
  "title" | "onChange" | "onDragOver" | "onDrop"
> & {
  /** Figma: Estado = Vazio · Enviando · Enviado · Erro. */
  state: FileFieldState;
  /** Figma: Título, the file asked for ("Frente do RG"). */
  title: ReactNode;
  /** Figma: Detalhe while empty, the formats accepted ("Fotos em JPG ou PNG; PDF até 3 MB."). */
  detail: ReactNode;
  /** The name of the file sent, shown in the detail's place once sent. */
  fileName?: ReactNode;
  /** The message of the error state, in the detail's place. */
  error?: ReactNode;
  /**
   * The types the picker offers (the input's `accept`). A dropped file skips it, so whoever
   * receives the file still checks it.
   */
  accept: string;
  /** A file chosen in the picker or dropped on the row. */
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

const icons: Record<FileFieldState, ReactNode> = {
  empty: <Upload className="text-icon-secondary" />,
  uploading: <LoaderCircle className="text-icon-accent motion-safe:animate-spin" />,
  sent: <CircleCheck className="text-icon-success" />,
  error: <TriangleAlert className="text-icon-danger" />,
};

/**
 * Figma: Envio de arquivo (253:371), one row per file of the verification or of a request for
 * information: the 40 tile with the state's icon, the title in Body/L Strong and a line in Body/M
 * (the formats, "Enviando…", the file's name or the error in text/danger), and the action, "Escolher"
 * (Botão/Secundário S) or "Trocar" once sent (Botão/Fantasma S). radius/lg, bg/surface,
 * border/subtle, border/danger on error. The action opens the browser's file picker, which on a
 * phone offers the camera or the gallery; on a desktop the file can also be dropped on the row.
 * The input is hidden: the button is the control, named by its label and the title, and the line
 * is announced as it changes.
 */
function FileField({
  state,
  title,
  detail,
  fileName,
  error,
  accept,
  onFileSelect,
  disabled = false,
  className,
  ...props
}: FileFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const takesFiles = state !== "uploading" && !disabled;

  const line =
    state === "uploading"
      ? "Enviando…"
      : state === "sent"
        ? (fileName ?? detail)
        : state === "error"
          ? (error ?? detail)
          : detail;

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

  return (
    <div
      data-slot="file-field"
      data-state={state}
      className={cn(
        // The edge is inside, as Figma's stroke: it takes no room from the padding.
        "flex w-full min-w-0 items-center gap-3 rounded-lg bg-bg-surface px-4 py-3 inset-ring inset-ring-border-subtle",
        "data-[state=error]:inset-ring-border-danger",
        className,
      )}
      onDragOver={dragOver}
      onDrop={drop}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-bg-subtle [&_svg]:size-icon-md"
      >
        {icons[state]}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0-5">
        <span id={`${id}-title`} className="type-body-l-strong wrap-break-word text-text-primary">
          {title}
        </span>
        <span
          id={`${id}-line`}
          aria-live="polite"
          className={cn(
            "type-body-m wrap-break-word text-text-secondary",
            state === "error" && "text-text-danger",
          )}
        >
          {line}
        </span>
      </span>
      {state === "uploading" ? null : (
        <Button
          id={`${id}-action`}
          variant={state === "sent" ? "ghost" : "secondary"}
          size="s"
          disabled={disabled}
          aria-labelledby={`${id}-action ${id}-title`}
          aria-describedby={`${id}-line`}
          onClick={() => inputRef.current?.click()}
        >
          {state === "sent" ? "Trocar" : "Escolher"}
        </Button>
      )}
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

export { FileField, type FileFieldProps, type FileFieldState };
