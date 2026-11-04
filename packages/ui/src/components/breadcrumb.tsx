import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Trilha, above a page's title (Evento · Rascunho, 591:12579; Novo evento, 586:11098): the
 * places before the page in Body/S text/tertiary, split by the 12 chevron-right, and the page in
 * text/secondary. shadcn/ui Breadcrumb, adapted.
 */
function Breadcrumb(props: ComponentProps<"nav">) {
  return <nav aria-label="Trilha" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1-5 type-body-s wrap-break-word text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1-5", className)}
      {...props}
    />
  );
}

/** A place before the page; with `asChild`, the app's link. */
function BreadcrumbLink({
  asChild = false,
  className,
  ...props
}: ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        "rounded-xs outline-none hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("text-text-secondary", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden
      className={cn("text-icon-secondary [&>svg]:size-icon-xs", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
