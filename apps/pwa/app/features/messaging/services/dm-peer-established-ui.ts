import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type DmPeerRequestStatusSnapshot = Readonly<{
  status?: string;
  isOutgoing?: boolean;
}> | null | undefined;

export type ResolveDmPeerEstablishedForUiParams = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
}>;

/** Pending connection handshakes stay in Requests — not the Chats sidebar (ASE-1d-a). */
export const isPendingContactHandshake = (
  requestStatus: DmPeerRequestStatusSnapshot,
): boolean => {
  if (!requestStatus) {
    return false;
  }
  const status = requestStatus.status ?? "pending";
  return status === "pending";
};

/**
 * Chats sidebar / compose unlock.
 * Explicit local accept (peer trust) is sticky across restart even when the
 * requests-inbox row briefly regresses to pending before projection catches up.
 */
export const resolveDmPeerEstablishedForUi = (
  params: ResolveDmPeerEstablishedForUiParams,
): boolean => (
  params.isPeerAcceptedByTrust
  || params.requestStatus?.status === "accepted"
);

export type ResolveDmPeerOutgoingWaitInitiatorForUiParams = Readonly<{
  requestStatus: DmPeerRequestStatusSnapshot;
}>;

/** Outgoing "waiting for acceptance" applies only to explicit outgoing-pending requests. */
export const resolveDmPeerOutgoingWaitInitiatorForUi = (
  params: ResolveDmPeerOutgoingWaitInitiatorForUiParams,
): boolean => (
  params.requestStatus?.isOutgoing === true
  && isPendingContactHandshake(params.requestStatus)
);

export const resolveDmPeerOutgoingResendEligibleForUi = (
  params: ResolveDmPeerOutgoingWaitInitiatorForUiParams,
): boolean => {
  if (params.requestStatus?.isOutgoing !== true) {
    return false;
  }
  const status = params.requestStatus.status;
  return status === "declined" || status === "canceled";
};
