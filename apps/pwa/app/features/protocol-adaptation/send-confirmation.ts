/**
 * K6/K7 — PAL-owned send confirmation exports.
 * Rich `SendConfirmation` (relay evidence) stays Obscur-Nostr pipeline-shaped;
 * `CanonicalSendConfirmation` is the slim protocol-neutral DTO.
 *
 * @see specs/backend/platform-k6-send-confirmation-pal-design-2026-11.md
 * @see specs/backend/platform-k7-canonical-send-confirmation-design-2026-11.md
 */

import type { DeliveryReasonCode } from "@dweb/core/security-foundation-contracts";
import type { SendConfirmation } from "@/app/features/messaging/controllers/v2/dm-send-pipeline";

export type { SendConfirmation };

export type CanonicalDeliveryStatus =
  | "sent_quorum"
  | "sent_partial"
  | "queued_retrying"
  | "pending_ack"
  | "failed";

/** Slim confirmation — no per-relay outcomes (use rich SendConfirmation for evidence UI). */
export type CanonicalSendConfirmation = Readonly<{
  success: boolean;
  deliveryStatus: CanonicalDeliveryStatus;
  error?: string;
  reasonCode?: DeliveryReasonCode;
  partialWireDelivery?: boolean;
  successCount: number;
  totalRelays: number;
}>;

export const toCanonicalSendConfirmation = (
  rich: SendConfirmation,
): CanonicalSendConfirmation => {
  const relayResults = rich.relayResults ?? [];
  return {
    success: rich.success,
    deliveryStatus: rich.deliveryStatus,
    error: rich.error,
    reasonCode: rich.reasonCode,
    partialWireDelivery: rich.partialWireDelivery,
    successCount: relayResults.filter((row) => row.success).length,
    totalRelays: relayResults.length,
  };
};
