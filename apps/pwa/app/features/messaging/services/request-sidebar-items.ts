import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DmConversation, RequestsInboxItem } from "@/app/features/messaging/types";
import { mergeLegacyOrphanRequestsInboxItems } from "./contact-request-legacy-orphan";
import type { DmPeerRequestStatusSnapshot } from "./dm-peer-established-ui";
import { getRequestsTabItems } from "./request-inbox-view";

/** Requests tab rows: inbox + legacy orphan threads + outgoing resend rows. */
export const buildSidebarRequestsInboxItems = (params: Readonly<{
  inboxItems: ReadonlyArray<RequestsInboxItem>;
  createdConnections: ReadonlyArray<DmConversation>;
  isPeerAcceptedByTrust: (peerPublicKeyHex: PublicKeyHex) => boolean;
  getRequestStatus: (peerPublicKeyHex: PublicKeyHex) => DmPeerRequestStatusSnapshot;
}>): ReadonlyArray<RequestsInboxItem> => {
  const merged = mergeLegacyOrphanRequestsInboxItems({
    inboxItems: params.inboxItems,
    createdConnections: params.createdConnections,
    isPeerAcceptedByTrust: params.isPeerAcceptedByTrust,
    getRequestStatus: params.getRequestStatus,
  });
  return getRequestsTabItems(merged);
};
