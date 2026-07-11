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
  const merged = [...params.inboxItems];
  const inboxPeers = new Set(merged.map((item) => item.peerPublicKeyHex));

  params.createdConnections.forEach((connection) => {
    if (connection.kind !== "dm") {
      return;
    }
    const peerPublicKeyHex = connection.pubkey;
    if (inboxPeers.has(peerPublicKeyHex)) {
      return;
    }
    if (!isLegacyOrphanDmThread({
      peerPublicKeyHex,
      isPeerAcceptedByTrust: params.isPeerAcceptedByTrust(peerPublicKeyHex),
      requestStatus: params.getRequestStatus(peerPublicKeyHex),
      hasDmThreadRow: true,
    })) {
      return;
    }

    merged.push({
      peerPublicKeyHex,
      lastMessagePreview: connection.lastMessage || "Connection request",
      lastReceivedAtUnixSeconds: Math.max(
        1,
        Math.floor(connection.lastMessageTime.getTime() / 1000),
      ),
      unreadCount: connection.unreadCount,
      status: "pending",
      isRequest: true,
      isOutgoing: false,
    });
    inboxPeers.add(peerPublicKeyHex);
  });

  return merged.sort((left, right) => right.lastReceivedAtUnixSeconds - left.lastReceivedAtUnixSeconds);
};

export const resolveEffectiveContactRequestStatus = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
  hasDmThreadRow: boolean;
}>): DmPeerRequestStatusSnapshot => {
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
  // Open DM thread without an inbox row still uses sandbox request UI (ASE-1d).
  if (
    params.hasDmThreadRow
    && !params.isPeerAcceptedByTrust
    && params.requestStatus?.isOutgoing !== true
  ) {
    return resolveLegacyOrphanRequestStatus({ isOutgoing: false });
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
