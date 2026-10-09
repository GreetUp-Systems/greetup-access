import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * The tables of the producer system (Eventos 307:2983, the events of the Painel, the ticket types
 * of an event): a bg/subtle header row (radius/md, space/2 by space/4, Label/S in text/tertiary)
 * right above rows of space/3 by space/4 split by border/subtle, so each divider has 12 on both
 * sides; space/4 between columns. Columns take a size/column-* width; the one left without a width
 * takes the rest. The screens draw it with frames, not a Figma component. shadcn/ui Table's parts,
 * laid out as flex rows with the table roles, so a row can be one link over the whole line.
 */
function Table({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="table"
      data-slot="table"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

/** The header row (one): give it the TableHead cells. */
function TableHeader({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div role="rowgroup" data-slot="table-header" {...props}>
      <div
        role="row"
        className={cn("flex items-center gap-4 rounded-md bg-bg-subtle px-4 py-2", className)}
      >
        {children}
      </div>
    </div>
  );
}

function TableBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="rowgroup"
      data-slot="table-body"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="row"
      data-slot="table-row"
      className={cn(
        "relative flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="columnheader"
      data-slot="table-head"
      className={cn("min-w-0 type-label-s text-text-tertiary", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentProps<"div">) {
  return <div role="cell" data-slot="table-cell" className={cn("min-w-0", className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
