import { resolvePeerDisplayName } from "@/app/features/profile/utils/resolve-peer-display-name";

/** Requests inbox rows should hydrate kind-0 metadata from relays (not cache-only). */
export const REQUEST_INBOX_PEER_METADATA_LIVE = true;

export const resolveRequestInboxPeerDisplayName = (params: Readonly<{
  pubkey: string;
  metadataDisplayName?: string | null;
  pendingInvitationFallback: string;
  unknownPeerFallback: string;
  isRequest?: boolean;
}>): string => (
  resolvePeerDisplayName({
    pubkey: params.pubkey,
    metadataDisplayName: params.metadataDisplayName,
    fallbackDisplayName: params.isRequest !== false
      ? params.pendingInvitationFallback
      : params.unknownPeerFallback,
  })
);
