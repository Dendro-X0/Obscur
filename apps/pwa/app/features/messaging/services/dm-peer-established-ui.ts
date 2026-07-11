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

/** Chats sidebar visibility — trust or relay-confirmed accept only (no legacy thread shortcut). */
export const resolveDmPeerEstablishedForUi = (
  params: ResolveDmPeerEstablishedForUiParams,
): boolean => {
  if (params.isPeerAcceptedByTrust) {
    return true;
  }
  return params.requestStatus?.status === "accepted";
};

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
