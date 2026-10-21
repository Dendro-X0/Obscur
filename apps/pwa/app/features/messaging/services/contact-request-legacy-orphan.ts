import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { DmConversation, RequestsInboxItem } from "@/app/features/messaging/types";
import type { DmPeerRequestStatusSnapshot } from "./dm-peer-established-ui";

/** Pre-ASE-1d DM thread rows for peers never accepted into trust or the requests inbox. */
export const isLegacyOrphanDmThread = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
  hasDmThreadRow: boolean;
}>): boolean => {
  if (!params.hasDmThreadRow || params.isPeerAcceptedByTrust) {
    return false;
  }
  if (!params.requestStatus) {
    return false;
  }
  const status = params.requestStatus.status;
  return status === undefined;
};

export const resolveLegacyOrphanRequestStatus = (params: Readonly<{
  isOutgoing?: boolean;
}>): DmPeerRequestStatusSnapshot => ({
  status: "pending",
  isOutgoing: params.isOutgoing ?? false,
});

export const mergeLegacyOrphanRequestsInboxItems = (params: Readonly<{
  inboxItems: ReadonlyArray<RequestsInboxItem>;
  createdConnections: ReadonlyArray<DmConversation>;
  isPeerAcceptedByTrust: (peerPublicKeyHex: PublicKeyHex) => boolean;
  getRequestStatus: (peerPublicKeyHex: PublicKeyHex) => DmPeerRequestStatusSnapshot;
}>): ReadonlyArray<RequestsInboxItem> => {
  void params.createdConnections;
  void params.isPeerAcceptedByTrust;
  void params.getRequestStatus;
  return [...params.inboxItems].sort(
    (left, right) => right.lastReceivedAtUnixSeconds - left.lastReceivedAtUnixSeconds,
  );
};

export const resolveEffectiveContactRequestStatus = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
  hasDmThreadRow: boolean;
}>): DmPeerRequestStatusSnapshot => {
  // Explicit Accept is sticky. Stale pending/declined inbox rows must not undo it
  // after restart when peer trust (or accept evidence) still says accepted.
  if (params.isPeerAcceptedByTrust) {
    return {
      status: "accepted",
      isOutgoing: params.requestStatus?.isOutgoing ?? false,
    };
  }
  if (params.requestStatus?.status) {
    return params.requestStatus;
  }
  if (isLegacyOrphanDmThread({
    peerPublicKeyHex: params.peerPublicKeyHex,
    isPeerAcceptedByTrust: params.isPeerAcceptedByTrust,
    requestStatus: params.requestStatus,
    hasDmThreadRow: params.hasDmThreadRow,
  })) {
    return resolveLegacyOrphanRequestStatus({
      isOutgoing: params.requestStatus?.isOutgoing,
    });
  }
  return params.requestStatus;
};

export const hasDmThreadRowForPeer = (
  peerPublicKeyHex: PublicKeyHex,
  dmPeerPubkeys: ReadonlySet<string>,
): boolean => {
  const normalized = normalizePublicKeyHex(peerPublicKeyHex);
  return Boolean(normalized && dmPeerPubkeys.has(normalized));
};
