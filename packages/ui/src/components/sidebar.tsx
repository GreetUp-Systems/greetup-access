"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Slot } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Avatar, AvatarFallback } from "@access/ui/components/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@access/ui/components/tooltip";
import { cn } from "@access/ui/lib/utils";

/**
 * Figma: Barra lateral (282:572) with Item de navegação (280:289), Conta na barra lateral (281:292)
 * and Alça da barra lateral (281:369). The desktop navigation of the producer
 * system: a floating bg/surface panel 12 from the edges, size/sidebar open or size/sidebar-collapsed
 * with icons only (⌘B), remembered in a cookie. Phones use the Barra de abas instead, so there is no
 * mobile sheet. shadcn/ui Sidebar (variant floating, collapsible icon), adapted.
 */
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextProps {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

function useSidebar(): SidebarContextProps {
  const context = useContext(SidebarContext);
  if (context === null) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

type SidebarProviderProps = ComponentProps<"div"> & {
  /** The state read from the cookie on the server, so the first paint already matches it. */
  defaultOpen?: boolean;
};

function SidebarProvider({
  defaultOpen = true,
  className,
  children,
  ...props
}: SidebarProviderProps) {
  const [open, setOpenState] = useState(defaultOpen);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const toggleSidebar = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const value = useMemo<SidebarContextProps>(
    () => ({ state: open ? "expanded" : "collapsed", open, setOpen, toggleSidebar }),
    [open, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        className={cn("flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({ className, children, ...props }: ComponentProps<"aside">) {
  const { state } = useSidebar();
  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === "collapsed" ? "icon" : ""}
      className="group peer hidden md:block"
    >
      {/* Keeps the panel's place in the layout: 12 to its left, 24 to the content. */}
      <div
        data-slot="sidebar-gap"
        className="mr-6 ml-3 w-sidebar transition-all duration-200 ease-linear group-data-[collapsible=icon]:w-sidebar-collapsed"
      />
      <aside
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-3 left-3 z-10 flex w-sidebar flex-col gap-6 rounded-xl border border-border-subtle bg-bg-surface px-4 pt-5 pb-4 text-text-primary transition-all duration-200 ease-linear group-data-[collapsible=icon]:w-sidebar-collapsed group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-3",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    </div>
  );
}

/** Figma: Alça da barra lateral. The round button on the panel's edge that closes or opens it. */
function SidebarTrigger({ className, onClick, ...props }: ComponentProps<"button">) {
  const { open, toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      aria-label={open ? "Recolher barra lateral" : "Abrir barra lateral"}
      aria-expanded={open}
      className={cn(
        "absolute top-5 -right-3 mt-2 flex size-icon-lg items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-icon-secondary shadow-elevation-1 outline-none hover:text-icon-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent [&_svg]:size-icon-sm",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {open ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
    </button>
  );
}

/** The page next to the panel. */
function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

/** Figma: Topo, the logo. */
function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex w-full flex-col group-data-[collapsible=icon]:items-center", className)}
      {...props}
    />
  );
}

/** Figma: Navegação. Takes the free height, so the account stays at the bottom. */
function SidebarContent({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto group-data-[collapsible=icon]:items-center",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex w-full flex-col group-data-[collapsible=icon]:items-center", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn(
        "flex w-full flex-col gap-1 group-data-[collapsible=icon]:items-center",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("w-full", className)} {...props} />;
}

type SidebarMenuButtonProps = ComponentProps<"button"> & {
  asChild?: boolean;
  /** Figma: Estado = Selecionado. */
  isActive?: boolean;
  /** Shown beside the icon when the panel is collapsed. */
  tooltip?: string;
};

/**
 * Figma: Item de navegação. Icon, label and an optional count (SidebarMenuBadge); collapsed, the
 * icon alone with a tooltip, the label kept for screen readers. Hover gets bg/subtle; the selected
 * one is a subtle card with a border, Elevation/1 and the icon in icon/accent.
 */
function SidebarMenuButton({
  asChild = false,
  isActive = false,
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { state } = useSidebar();
  const Comp = asChild ? Slot.Root : "button";
  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/menu-button flex h-control-md w-full items-center gap-3 rounded-md px-3 text-left type-body-m-strong text-text-secondary outline-none hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent [&>span:first-of-type]:flex-1 [&>span:first-of-type]:truncate [&>svg]:size-icon-md [&>svg]:shrink-0 [&>svg]:text-icon-secondary hover:[&>svg]:text-icon-primary",
        "data-[active=true]:border data-[active=true]:border-border-subtle data-[active=true]:bg-bg-subtle data-[active=true]:text-text-primary data-[active=true]:shadow-elevation-1 data-[active=true]:[&>svg]:text-icon-accent",
        "group-data-[collapsible=icon]:size-control-md group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span:first-of-type]:sr-only group-data-[collapsible=icon]:[&>span:not(:first-of-type)]:hidden",
        className,
      )}
      {...props}
    />
  );
  if (tooltip === undefined) {
    return button;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" hidden={state !== "collapsed"}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Figma: Selo. The count of an item; on hover bg/surface, selected bg/accent-subtle. */
function SidebarMenuBadge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "flex h-status-s min-w-status-s items-center justify-center rounded-full bg-bg-subtle px-1-5 type-badge-s text-text-secondary group-hover/menu-button:bg-bg-surface group-data-[active=true]/menu-button:bg-bg-accent-subtle group-data-[active=true]/menu-button:text-text-accent",
        className,
      )}
      {...props}
    />
  );
}

type SidebarAccountButtonProps = ComponentProps<"button"> & {
  /** Two letters for the avatar. */
  initials: string;
  name: ReactNode;
  email: ReactNode;
};

/**
 * Figma: Conta na barra lateral. Who is signed in, at the bottom: it opens the account menu, and
 * while it is open (data-state=open) it turns bg/subtle. The edge is an inset ring, so the button
 * keeps Figma's 56 with the 40 avatar inside.
 */
function SidebarAccountButton({
  initials,
  name,
  email,
  className,
  ...props
}: SidebarAccountButtonProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-account"
      className={cn(
        "flex w-full items-center gap-3 rounded-md bg-bg-canvas p-2 text-left inset-ring inset-ring-border-subtle outline-none hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-accent data-[state=open]:bg-bg-subtle",
        "group-data-[collapsible=icon]:w-control-md group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0-5",
        className,
      )}
      {...props}
    >
      {/* The initials repeat the name, so screen readers hear the name and the e-mail only. */}
      <Avatar size="m" aria-hidden>
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0-5 group-data-[collapsible=icon]:sr-only">
        <span className="truncate type-body-m-strong text-text-primary">{name}</span>
        <span className="truncate type-body-s text-text-tertiary">{email}</span>
      </span>
      <ChevronsUpDown
        aria-hidden
        className="size-icon-sm shrink-0 text-icon-secondary group-data-[collapsible=icon]:hidden"
      />
    </button>
  );
}

export {
  Sidebar,
  SidebarAccountButton,
  type SidebarAccountButtonProps,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  type SidebarMenuButtonProps,
  SidebarMenuItem,
  SidebarProvider,
  type SidebarProviderProps,
  type SidebarState,
  SidebarTrigger,
  useSidebar,
};
