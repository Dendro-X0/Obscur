"use client";

/**
 * W64 post-subtraction port — thin re-exports from subtracted module.
 * Copied into `relay-standalone-publish-port.ts` when production legacy is deleted.
 */

export {
  publishToRelayStandaloneSubtracted as publishToRelayStandalone,
  publishToUrlsStandaloneSubtracted as publishToUrlsStandalone,
} from "./relay-standalone-publish-port-subtracted";
