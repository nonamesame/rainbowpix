"use client";

/**
 * Returns the scroll container element (the <main> in AppShell).
 * All page content scrolls within this container instead of the document body.
 */
export function useScrollContainer(): HTMLElement {
  if (typeof document === "undefined") return {} as HTMLElement;
  return (document.querySelector("main") as HTMLElement) || document.documentElement;
}
