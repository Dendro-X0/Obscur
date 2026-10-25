"use client";

import { startTransition } from "react";

export type SidebarNavigationRouter = Readonly<{
  push: (href: string) => void;
}>;

/** Yields one animation frame so imperative + React loading chrome can paint before route work. */
export const yieldToNextPaint = (): Promise<void> => new Promise((resolve) => {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => resolve());
    return;
  }
  setTimeout(resolve, 0);
});

/**
 * Schedules a sidebar route change at transition priority after the next paint.
 * Keeps pathname commits responsive when the destination route mounts many components.
 */
export const scheduleSidebarNavigation = (
  router: SidebarNavigationRouter,
  targetHref: string,
  options?: Readonly<{ immediate?: boolean }>,
): void => {
  const push = (): void => {
    startTransition(() => {
      router.push(targetHref);
    });
  };
  if (options?.immediate) {
    // Same-tick push — startTransition can defer under main-thread pressure and
    // make mobile tab taps feel dead while a cold route compiles.
    router.push(targetHref);
    return;
  }
  void yieldToNextPaint().then(push);
};
