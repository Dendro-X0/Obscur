import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

export type DmPeerRequestStatusSnapshot = Readonly<{
  status?: string;
  isOutgoing?: boolean;
}> | null | undefined;

export type ResolveDmPeerEstablishedForUiParams = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
  /** Peers with an existing DM thread row (sidebar / SQLite / chat-state). */
  establishedDmPeerPubkeys: ReadonlySet<string>;
}>;

/**
 * Avoid boot-time "unaccepted" UI when trust / request inbox hydrate after the conversation list.
 * An established DM thread is stronger evidence than a transient empty inbox snapshot.
 */
export const resolveDmPeerEstablishedForUi = (
  params: ResolveDmPeerEstablishedForUiParams,
): boolean => {
  if (params.isPeerAcceptedByTrust) {
    return true;
  }
  const requestStatus = params.requestStatus;
  if (requestStatus?.status === "accepted") {
    return true;
  }
  if (requestStatus?.isOutgoing && (requestStatus.status === "pending" || !requestStatus.status)) {
    return true;
  }
  const normalizedPeer = normalizePublicKeyHex(params.peerPublicKeyHex);
  if (normalizedPeer && params.establishedDmPeerPubkeys.has(normalizedPeer)) {
    return true;
  }
  return false;
};

export type ResolveDmPeerOutgoingWaitInitiatorForUiParams = Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  requestStatus: DmPeerRequestStatusSnapshot;
  hasInboxItemForPeer: boolean;
  establishedDmPeerPubkeys: ReadonlySet<string>;
}>;

/** "Waiting for acceptance" applies only to genuine outgoing-pending strangers, not restored threads. */
export const resolveDmPeerOutgoingWaitInitiatorForUi = (
  params: ResolveDmPeerOutgoingWaitInitiatorForUiParams,
): boolean => {
  const normalizedPeer = normalizePublicKeyHex(params.peerPublicKeyHex);
  if (normalizedPeer && params.establishedDmPeerPubkeys.has(normalizedPeer)) {
    return false;
  }
  const requestStatus = params.requestStatus;
  if (requestStatus?.isOutgoing && (requestStatus.status === "pending" || !requestStatus.status)) {
    return true;
  }
  return !params.hasInboxItemForPeer;
};
