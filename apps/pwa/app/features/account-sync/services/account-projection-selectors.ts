import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ConnectionRequestStatusValue, DmConversation, RequestsInboxItem } from "@/app/features/messaging/types";
import type { Message } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { AccountProjectionSnapshot } from "../account-event-contracts";

const EMPTY_ITEMS: ReadonlyArray<RequestsInboxItem> = [];
const EMPTY_PEERS: ReadonlyArray<PublicKeyHex> = [];
const EMPTY_CONVERSATIONS: ReadonlyArray<DmConversation> = [];
const EMPTY_MESSAGES: ReadonlyArray<Message> = [];

type PeerConversationSummary = Readonly<{
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
  unreadCount: number;
  conversationId: string;
}>;

const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const directPeer = normalizePublicKeyHex(params.conversationId.trim());
  if (directPeer && directPeer !== params.myPublicKeyHex) {
    return directPeer;
  }

  const parts = params.conversationId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const left = normalizePublicKeyHex(parts[0]);
  const right = normalizePublicKeyHex(parts[1]);
  if (!left || !right) {
    return null;
  }
  if (left === params.myPublicKeyHex && right !== params.myPublicKeyHex) {
    return right;
  }
  if (right === params.myPublicKeyHex && left !== params.myPublicKeyHex) {
    return left;
  }
  return null;
};

const resolveConversationPeer = (params: Readonly<{
  projection: AccountProjectionSnapshot;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const fromConversationProjection = params.projection.conversationsById[params.conversationId]?.peerPublicKeyHex;
  if (fromConversationProjection) {
    return fromConversationProjection;
  }
  const fromTimeline = params.projection.messagesByConversationId[params.conversationId]?.[0]?.peerPublicKeyHex;
  if (fromTimeline) {
    return fromTimeline;
  }
  return inferPeerFromConversationId({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
};

const collectConversationTimelineEntries = (params: Readonly<{
  projection: AccountProjectionSnapshot;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<AccountProjectionSnapshot["messagesByConversationId"][string][number]> => {
  const directTimeline = params.projection.messagesByConversationId[params.conversationId] ?? [];
  const resolvedPeer = resolveConversationPeer(params);
  if (!resolvedPeer) {
    return directTimeline;
  }

  const byMessageId = new Map<string, AccountProjectionSnapshot["messagesByConversationId"][string][number]>();
  directTimeline.forEach((entry) => {
    byMessageId.set(entry.messageId, entry);
  });

  Object.values(params.projection.messagesByConversationId).forEach((timeline) => {
    timeline.forEach((entry) => {
      if (entry.peerPublicKeyHex !== resolvedPeer) {
        return;
      }
      const existing = byMessageId.get(entry.messageId);
      if (!existing) {
        byMessageId.set(entry.messageId, entry);
        return;
      }
      if (entry.eventCreatedAtUnixSeconds > existing.eventCreatedAtUnixSeconds) {
        byMessageId.set(entry.messageId, entry);
        return;
      }
      if (
        entry.eventCreatedAtUnixSeconds === existing.eventCreatedAtUnixSeconds
        && entry.observedAtUnixMs > existing.observedAtUnixMs
      ) {
        byMessageId.set(entry.messageId, entry);
      }
    });
  });

  return Array.from(byMessageId.values());
};

const buildLatestConversationByPeer = (
  projection: AccountProjectionSnapshot
): Readonly<Record<string, PeerConversationSummary>> => {
  const byPeer: Record<string, PeerConversationSummary> = {};
  Object.values(projection.conversationsById).forEach((conversation) => {
    const existing = byPeer[conversation.peerPublicKeyHex];
    if (!existing || conversation.lastMessageAtUnixMs > existing.lastMessageAtUnixMs) {
      byPeer[conversation.peerPublicKeyHex] = {
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAtUnixMs: conversation.lastMessageAtUnixMs,
        unreadCount: conversation.unreadCount,
        conversationId: conversation.conversationId,
      };
    }
  });
  return byPeer;
};

export const selectProjectionAcceptedPeers = (
  projection: AccountProjectionSnapshot | null
): ReadonlyArray<PublicKeyHex> => {
  if (!projection) {
    return EMPTY_PEERS;
  }
  return Object.values(projection.contactsByPeer)
    .filter((contact) => contact.status === "accepted")
    .map((contact) => contact.peerPublicKeyHex)
    .sort();
};

export const selectProjectionRequestsInboxItems = (
  projection: AccountProjectionSnapshot | null
): ReadonlyArray<RequestsInboxItem> => {
  if (!projection) {
    return EMPTY_ITEMS;
  }
  const latestConversationByPeer = buildLatestConversationByPeer(projection);
  return Object.values(projection.contactsByPeer)
    .filter((contact) => contact.status !== "none")
    .map((contact): RequestsInboxItem => {
      const conversation = latestConversationByPeer[contact.peerPublicKeyHex];
      const status = contact.status as ConnectionRequestStatusValue;
      return {
        peerPublicKeyHex: contact.peerPublicKeyHex,
        lastMessagePreview: conversation?.lastMessagePreview ?? "",
        lastReceivedAtUnixSeconds: Math.floor(contact.lastEvidenceAtUnixMs / 1000),
        unreadCount: 0,
        status,
        isOutgoing: contact.direction === "outgoing",
        eventId: contact.lastRequestEventId ?? contact.lastEventId,
      };
    })
    .sort((left, right) => {
      if (left.lastReceivedAtUnixSeconds !== right.lastReceivedAtUnixSeconds) {
        return right.lastReceivedAtUnixSeconds - left.lastReceivedAtUnixSeconds;
      }
      return left.peerPublicKeyHex.localeCompare(right.peerPublicKeyHex);
    });
};

export const selectProjectionDmConversations = (params: Readonly<{
  projection: AccountProjectionSnapshot | null;
  myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<DmConversation> => {
  if (!params.projection) {
    return EMPTY_CONVERSATIONS;
  }

  const latestConversationByPeer = buildLatestConversationByPeer(params.projection);
  const contacts = Object.values(params.projection.contactsByPeer)
    .filter((contact) => contact.status === "accepted");

  return contacts
    .map((contact): DmConversation => {
      const conversation = latestConversationByPeer[contact.peerPublicKeyHex];
      const conversationId = conversation?.conversationId
        ?? [params.myPublicKeyHex, contact.peerPublicKeyHex].sort().join(":");
      return {
        kind: "dm",
        id: conversationId,
        pubkey: contact.peerPublicKeyHex,
        displayName: contact.peerPublicKeyHex.slice(0, 8),
        lastMessage: conversation?.lastMessagePreview ?? "",
        unreadCount: conversation?.unreadCount ?? 0,
        lastMessageTime: new Date(conversation?.lastMessageAtUnixMs ?? 0),
      };
    })
    .sort((left, right) => right.lastMessageTime.getTime() - left.lastMessageTime.getTime());
};

export const selectProjectionConversationMessages = (params: Readonly<{
  projection: AccountProjectionSnapshot | null;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<Message> => {
  if (!params.projection) {
    return EMPTY_MESSAGES;
  }
  const timeline = collectConversationTimelineEntries({
    projection: params.projection,
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  if (!timeline || timeline.length === 0) {
    return EMPTY_MESSAGES;
  }

  return [...timeline]
    .sort((left, right) => {
      if (left.eventCreatedAtUnixSeconds !== right.eventCreatedAtUnixSeconds) {
        return left.eventCreatedAtUnixSeconds - right.eventCreatedAtUnixSeconds;
      }
      return left.messageId.localeCompare(right.messageId);
    })
    .map((entry): Message => {
      const isOutgoing = entry.direction === "outgoing";
      return {
        id: entry.messageId,
        kind: "user",
        content: entry.plaintextPreview,
        timestamp: new Date(entry.eventCreatedAtUnixSeconds * 1000),
        isOutgoing,
        status: "delivered",
        eventId: entry.messageId,
        eventCreatedAt: new Date(entry.eventCreatedAtUnixSeconds * 1000),
        senderPubkey: isOutgoing ? params.myPublicKeyHex : entry.peerPublicKeyHex,
        recipientPubkey: isOutgoing ? entry.peerPublicKeyHex : params.myPublicKeyHex,
        conversationId: entry.conversationId,
      };
    });
};
