import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

export type MessagingListChromeVariant = "desktop" | "mobile";

/**
 * Product shell owns messaging list chrome — not viewport width.
 * Desktop release / desktop Tauri must never pick mobile underline-tabs chrome.
 */
export const resolveMessagingListChromeVariant = (): MessagingListChromeVariant => (
  isMobileShellProduct() ? "mobile" : "desktop"
);
