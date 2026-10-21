import type { SendResult } from "../controllers/v2/dm-controller-types";

/**
 * Call signaling (offer/answer/ICE/join/leave) under a degraded relay pool.
 * Matches invite provisional honesty: Phase-1 wire evidence is enough to keep
 * the WebRTC handshake alive; `pending_ack` is not a hard failure for signals.
 */
export const isVoiceCallSignalDeliveryAccepted = (params: Readonly<{
  deliveryStatus: SendResult["deliveryStatus"] | undefined;
  success?: boolean;
  partialWireDelivery?: boolean;
  eventId?: string;
  relayResults?: ReadonlyArray<{ success: boolean }>;
}>): boolean => {
  if (
    params.deliveryStatus === "sent_quorum"
    || params.deliveryStatus === "sent_partial"
    || params.deliveryStatus === "pending_ack"
    || params.deliveryStatus === "queued_retrying"
  ) {
    return true;
  }
  if (
    params.deliveryStatus === "failed"
    && params.partialWireDelivery === true
    && typeof params.eventId === "string"
    && params.eventId.trim().length > 0
  ) {
    return true;
  }
  // Legacy SendResult without deliveryStatus
  if (params.deliveryStatus === undefined) {
    if (params.success === true) {
      return true;
    }
    if (params.relayResults?.some((r) => r.success)) {
      return true;
    }
  }
  return false;
};
