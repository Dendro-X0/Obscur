import type { SendResult } from "../controllers/v2/dm-controller-types";

/**
 * Voice invite must not treat Phase-1 `pending_ack` as a hard failure.
 * Only confirmed quorum/partial (or true queued) are terminal acceptances for invite UX.
 */
export const isVoiceCallInviteDeliveryAccepted = (
  deliveryStatus: SendResult["deliveryStatus"] | undefined,
): boolean => (
  deliveryStatus === "sent_quorum"
  || deliveryStatus === "sent_partial"
);

export const isVoiceCallInviteDeliveryPending = (
  deliveryStatus: SendResult["deliveryStatus"] | undefined,
): boolean => deliveryStatus === "pending_ack";

/**
 * Public-path F-ACK: Phase-1 may wire the EVENT while Phase-2 OK is missing.
 * Allow provisional invite start (ring) when wire evidence exists; still not `sent_quorum`.
 */
export const isVoiceCallInviteDeliveryProvisional = (params: Readonly<{
  deliveryStatus: SendResult["deliveryStatus"] | undefined;
  partialWireDelivery?: boolean;
  eventId?: string;
}>): boolean => (
  params.deliveryStatus === "failed"
  && params.partialWireDelivery === true
  && typeof params.eventId === "string"
  && params.eventId.trim().length > 0
);

export const shouldStartVoiceCallInviteSession = (params: Readonly<{
  deliveryStatus: SendResult["deliveryStatus"] | undefined;
  partialWireDelivery?: boolean;
  eventId?: string;
}>): boolean => (
  isVoiceCallInviteDeliveryAccepted(params.deliveryStatus)
  || isVoiceCallInviteDeliveryProvisional(params)
);

/**
 * PB1-C dial preflight — do not publish an invite when no relay socket is open.
 * Matches hitch honesty when the chrome shows Offline 0/0 active relays.
 */
export const canStartVoiceCallInviteDial = (params: Readonly<{
  openRelayCount: number;
}>): boolean => (
  Number.isFinite(params.openRelayCount) && params.openRelayCount > 0
);
