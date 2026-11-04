"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, following its changes (shadcn/ui's responsive dialog: a Dialog on
 * the desktop, a Drawer on the phone). The server and the first render answer `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The design system's only breakpoint, `md:` (768). */
export const DESKTOP_QUERY = "(min-width: 768px)";
