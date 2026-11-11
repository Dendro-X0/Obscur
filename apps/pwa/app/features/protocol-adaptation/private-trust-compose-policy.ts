/**
 * Cut 2.2 face policy — owned by @obscur/private-trust-engine (shared with Vite Cut 3.3).
 * Keep this file as the pwa re-export surface so existing imports stay stable.
 */
export {
  PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED,
  isPrivateTrustComposeFace,
  privateTrustComposeTransportCopy,
} from "@obscur/private-trust-engine";
