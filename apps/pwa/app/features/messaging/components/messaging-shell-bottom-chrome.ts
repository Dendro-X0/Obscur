/** Shared footer chrome so sidebar relay status aligns with the chat composer column. */
export const MESSAGING_SHELL_BOTTOM_CHROME_CLASS =
  // Bottom: `.pb-composer-safe` owns home-indicator inset (no shell pad under thread).
  "shrink-0 border-t border-black/[0.03] bg-white/80 px-4 pt-4 pb-composer-safe dark:border-white/[0.03] dark:bg-black/80 backdrop-blur-xl";

/**
 * Mobile thread: flush composer bar — no glass slab, no lab chip row, no status strip.
 * Matches native chat footers (input sits on the surface edge).
 */
export const MESSAGING_SHELL_BOTTOM_CHROME_MOBILE_CLASS =
  "shrink-0 border-t border-black/10 bg-background/95 px-3 pt-2 pb-composer-safe dark:border-white/10";

/** Matches the composer input capsule row (h-12 controls + p-1.5 padding). */
export const MESSAGING_SHELL_BOTTOM_CHROME_PRIMARY_ROW_CLASS =
  "flex min-h-[3.75rem] items-center";

/** Reserves the composer status row height beneath the primary footer content. */
export const MESSAGING_SHELL_BOTTOM_CHROME_STATUS_ROW_CLASS =
  "mt-3 flex min-h-5 items-center justify-between px-2";

export const MESSAGING_SHELL_BOTTOM_CHROME_STATUS_SPACER_CLASS = "mt-3 h-5";

/**
 * Absolute overlays (history search panel / batch delete) sit above the composer.
 * Desktop/lab budgets for chips + status; mobile thread uses the shorter class.
 */
export const MESSAGING_SHELL_FLOATING_ABOVE_COMPOSER_CLASS =
  "pointer-events-none absolute z-40 flex w-[min(24rem,calc(100%-2rem))] flex-col items-end gap-2 right-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom,0px))] sm:right-4 sm:bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))]";

/** Mobile thread: chips/status hidden — clear the flush composer row only. */
export const MESSAGING_SHELL_FLOATING_ABOVE_COMPOSER_MOBILE_CLASS =
  "pointer-events-none absolute z-40 flex w-[min(24rem,calc(100%-1.5rem))] flex-col items-end gap-2 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]";

/** Window event: mobile thread header opens in-chat history search. */
export const CHAT_HISTORY_SEARCH_OPEN_EVENT = "obscur:chat-history-search-open";
