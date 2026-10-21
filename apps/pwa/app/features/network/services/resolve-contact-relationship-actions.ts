import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { RequestProjection } from "@/app/features/messaging/services/request-status-projection";

export type ContactRelationshipActions = Readonly<{
  isTrustedContact: boolean;
  canMessage: boolean;
  canVoiceCall: boolean;
}>;

const EMPTY_ACTIONS: ContactRelationshipActions = {
  isTrustedContact: false,
  canMessage: false,
  canVoiceCall: false,
};

export const isContactHandshakeComplete = (
  requestProjection: RequestProjection,
): boolean => requestProjection.state === "accepted";

/**
 * Unified relationship action selector (containment slice 2026-08).
 * Privileged CTAs require decisive handshake completion — not address-book
 * presence, stale trust, or projection acceptance alone after local removal.
 */
export const resolveContactRelationshipActions = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  peerTrustAccepted: boolean;
  projection: AccountProjectionSnapshot | null;
  useProjectionReads: boolean;
  requestProjection: RequestProjection;
}>): ContactRelationshipActions => {
  if (!params.peerTrustAccepted) {
    return EMPTY_ACTIONS;
  }

  const handshakeComplete = isContactHandshakeComplete(params.requestProjection);
  if (!handshakeComplete) {
    return EMPTY_ACTIONS;
  }

  if (params.useProjectionReads) {
    if (!params.projection) {
      return EMPTY_ACTIONS;
    }
    const projectionContact = params.projection.contactsByPeer[params.peerPublicKeyHex];
    if (projectionContact?.status !== "accepted") {
      return EMPTY_ACTIONS;
    }
  }

  return {
    isTrustedContact: true,
    canMessage: true,
    canVoiceCall: true,
  };
};
