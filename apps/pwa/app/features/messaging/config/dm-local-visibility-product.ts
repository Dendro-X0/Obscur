/**
 * v1.5.1 — Honest local visibility copy and behavior flags.
 * Cooperative delete-for-everyone UI remains in dm-redaction-product.ts (off until v1.6).
 */

export { DM_DELETE_FOR_EVERYONE_UI_ENABLED } from "./dm-redaction-product";

/**
 * Cooperative recall UI is off: not ecosystem-guaranteed on Nostr (see docs/messaging/dm-recall-for-everyone.md).
 * Ingress may still apply remote delete commands from peers; only "Hide on this device" is product-supported.
 */
export const DM_RECALL_FOR_EVERYONE_UI_ENABLED = false;

/** Default EN strings; i18n keys mirror `messaging.*` entries in message-menu / chat-view. */
export const DM_LOCAL_VISIBILITY_COPY = {
  hideOnThisDevice: "Hide on this device",
  hideOnThisDeviceWithCount: "Hide on this device ({{count}})",
  showAgainOnThisDevice: "Show again on this device",
  hiddenOnThisDeviceCount: "Hidden on this device ({{count}})",
  batchScopeHelper:
    "Hides selected messages on this device only. Other devices and relays may still have copies.",
  recallForEveryone: "Recall for everyone",
  recallForEveryoneWithCount: "Recall for everyone ({{count}})",
  recallScopeHelper:
    "Sends a recall request to your contact's Obscur app. Relays and other clients may still show the message.",
} as const;

/**
 * User-initiated hide keeps timeline events for optional show-again.
 * Cooperative redaction ingress may still redact when applying remote delete commands.
 */
export const DM_HIDE_PRESERVE_TIMELINE_FOR_SHOW_AGAIN = true;
