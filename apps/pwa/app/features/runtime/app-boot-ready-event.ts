/**
 * Phase 1: boot watchdog in `app/layout.tsx` listens for this event name (keep in sync with inline script).
 * Deliberately avoids the legacy `obscur:` window-event prefix.
 */
export const APP_BOOT_READY_EVENT = "dweb:app-boot-ready" as const;
