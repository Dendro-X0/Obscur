/** Scroll + brief visual pulse for in-app search jump targets (settings, chat, discovery). */

export const SEARCH_TARGET_FLASH_CLASS = "obscur-search-target-flash";
export const SEARCH_TARGET_FLASH_MS = 2200;

export const settingsTabPanelElementId = (tab: string): string => (
  `settings-tab-panel-${tab.trim()}`
);

export const discoverySearchResultElementId = (canonicalId: string): string => {
  const safe = canonicalId.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `discovery-search-result-${safe || "unknown"}`;
};

export const DISCOVERY_EXACT_MATCH_ELEMENT_ID = "discovery-exact-match";

export const discoverySuggestionElementId = (pubkey: string): string => {
  const safe = pubkey.trim().slice(0, 16);
  return `discovery-suggestion-${safe || "unknown"}`;
};

export const scrollToSearchTargetElement = (
  element: HTMLElement | null,
  options?: Readonly<{ behavior?: ScrollBehavior; block?: ScrollLogicalPosition }>,
): void => {
  if (!element) {
    return;
  }
  element.scrollIntoView({
    behavior: options?.behavior ?? "smooth",
    block: options?.block ?? "center",
  });
};

export const flashSearchTargetElement = (
  element: HTMLElement | null,
  options?: Readonly<{ durationMs?: number; className?: string }>,
): (() => void) => {
  if (!element || typeof window === "undefined") {
    return () => {};
  }
  const className = options?.className ?? SEARCH_TARGET_FLASH_CLASS;
  const durationMs = options?.durationMs ?? SEARCH_TARGET_FLASH_MS;
  element.classList.add(className);
  element.setAttribute("data-search-target-flash", "active");
  const timer = window.setTimeout(() => {
    element.classList.remove(className);
    element.removeAttribute("data-search-target-flash");
  }, durationMs);
  return () => {
    window.clearTimeout(timer);
    element.classList.remove(className);
    element.removeAttribute("data-search-target-flash");
  };
};

export const focusSearchTargetById = (
  elementId: string,
  options?: Readonly<{
    scrollDelayMs?: number;
    behavior?: ScrollBehavior;
    block?: ScrollLogicalPosition;
    flashDurationMs?: number;
    maxResolveAttempts?: number;
    resolveRetryMs?: number;
  }>,
): (() => void) => {
  if (typeof document === "undefined" || elementId.trim().length === 0) {
    return () => {};
  }
  const scrollDelayMs = options?.scrollDelayMs ?? 100;
  const maxResolveAttempts = options?.maxResolveAttempts ?? 1;
  const resolveRetryMs = options?.resolveRetryMs ?? 80;
  let cancelled = false;
  let cancelFlash = (): void => {};
  let scrollTimer: number | null = null;
  let resolveTimer: number | null = null;

  const attemptFocus = (resolveAttempt: number): void => {
    if (cancelled) {
      return;
    }
    const element = document.getElementById(elementId);
    if (element) {
      scrollToSearchTargetElement(element, {
        behavior: options?.behavior,
        block: options?.block,
      });
      cancelFlash = flashSearchTargetElement(element, {
        durationMs: options?.flashDurationMs,
      });
      return;
    }
    if (resolveAttempt + 1 < maxResolveAttempts) {
      resolveTimer = window.setTimeout(() => {
        attemptFocus(resolveAttempt + 1);
      }, resolveRetryMs);
    }
  };

  const frame = window.requestAnimationFrame(() => {
    scrollTimer = window.setTimeout(() => {
      attemptFocus(0);
    }, scrollDelayMs);
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    if (scrollTimer !== null) {
      window.clearTimeout(scrollTimer);
    }
    if (resolveTimer !== null) {
      window.clearTimeout(resolveTimer);
    }
    cancelFlash();
  };
};
