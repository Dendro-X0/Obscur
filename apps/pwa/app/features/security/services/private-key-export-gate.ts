export const PRIVATE_KEY_EXPORT_CONFIRM_TEXT = "EXPORT KEY";

export const PRIVATE_KEY_CLIPBOARD_CLEAR_MS = 30_000;

/** Best-effort clipboard wipe after copying secret material. */
export const schedulePrivateKeyClipboardClear = (
  delayMs: number = PRIVATE_KEY_CLIPBOARD_CLEAR_MS,
): (() => void) => {
  if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
    return () => {};
  }
  const timer = window.setTimeout(() => {
    void navigator.clipboard.writeText("").catch(() => {
      // Clipboard may be denied after tab blur — ignore.
    });
  }, delayMs);
  return () => window.clearTimeout(timer);
};

export const isPrivateKeyExportConfirmed = (input: string): boolean => (
  input.trim().toUpperCase() === PRIVATE_KEY_EXPORT_CONFIRM_TEXT
);
