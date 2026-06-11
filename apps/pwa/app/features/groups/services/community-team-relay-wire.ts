import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import {
  isSemanticCommunityMemberEvent,
  type SemanticCommunityEvent,
} from "@dweb/transport-contracts";
import {
  RELAY_KIND_RELAY_JOIN,
  RELAY_KIND_RELAY_LEAVE,
} from "./community-relay-membership-interop";

/**
 * Maps kernel semantic membership events to NIP-29 relay-visible wire (Path B team relay hints).
 * Membership truth remains on coordination; these events are chat-adjacent hints only.
 */
export const buildTeamRelayMembershipUnsignedEvent = (
  event: SemanticCommunityEvent,
): UnsignedNostrEvent | null => {
  if (!isSemanticCommunityMemberEvent(event)) {
    return null;
  }

  const groupId = event.communityId.trim();
  if (!groupId) {
    return null;
  }

  const created_at = Math.floor(event.createdAtUnixMs / 1000);
  const subject = event.subjectPublicKeyHex.trim();

  if (event.type === "COMMUNITY_MEMBER_JOINED") {
    return {
      kind: RELAY_KIND_RELAY_JOIN,
      created_at,
      tags: [["h", groupId]],
      content: "",
      pubkey: subject,
    };
  }

  if (event.type === "COMMUNITY_MEMBER_LEFT" || event.type === "COMMUNITY_MEMBER_EXPELLED") {
    return {
      kind: RELAY_KIND_RELAY_LEAVE,
      created_at,
      tags: [["h", groupId]],
      content: "",
      pubkey: subject,
    };
  }

  return null;
};
