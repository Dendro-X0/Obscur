import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ConnectionRequestStatusValue, DmConversation, RequestsInboxItem } from "@/app/features/messaging/types";
import type { Message } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { AccountProjectionSnapshot } from "../account-event-contracts";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { isAccountProjectionTimelineEntrySuppressed } from "@/app/features/messaging/services/conversation-message-visibility";
import { messagingClientOperations } from "@/app/features/messaging/services/messaging-client-operations";
import { toConversationListPreview } from "./account-event-plaintext-preview";
import { applyCommunityInviteMessageSnapshot } from "@/app/features/groups/utils/community-invite-message-snapshot";
import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import { buildCommunityInvitePlaintext } from "@/app/features/groups/utils/community-invite-dm-message";
import type { GroupMetadata } from "@/app/features/groups/types";
import type { InvitePayload } from "@/app/features/groups/utils/community-invite-payload";

const toInviteGroupMetadata = (metadata: InvitePayload["metadata"]): GroupMetadata => {
  const access = metadata.access;
  const normalizedAccess: GroupMetadata["access"] = (
    access === "open" || access === "discoverable" || access === "invite-only"
  )
    ? access
    : "invite-only";
  return {
    id: metadata.id,
    name: metadata.name,
    about: metadata.about,
    picture: metadata.picture,
    access: normalizedAccess,
    memberCount: metadata.memberCount,
  };
};

const EMPTY_ITEMS: ReadonlyArray<RequestsInboxItem> = [];
const EMPTY_PEERS: ReadonlyArray<PublicKeyHex> = [];
const EMPTY_CONVERSATIONS: ReadonlyArray<DmConversation> = [];
const EMPTY_MESSAGES: ReadonlyArray<Message> = [];

type PeerConversationSummary = Readonly<{
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
  unreadCount: number;
  conversationId: string;
  lastMessageIsOutgoing?: boolean;
}>;

type MessageProjectionEntry = AccountProjectionSnapshot["messagesByConversationId"][string][number];

const compareTimelineEntries = (
  left: MessageProjectionEntry,
  right: MessageProjectionEntry,
): number => {
  if (left.eventCreatedAtUnixSeconds !== right.eventCreatedAtUnixSeconds) {
    return left.eventCreatedAtUnixSeconds - right.eventCreatedAtUnixSeconds;
  }
  return left.messageId.localeCompare(right.messageId);
};

const findLatestPeerTimelineEntry = (
  projection: AccountProjectionSnapshot,
  peerPublicKeyHex: PublicKeyHex,
): MessageProjectionEntry | null => {
  let latest: MessageProjectionEntry | null = null;
  Object.values(projection.messagesByConversationId).forEach((timeline) => {
    timeline.forEach((entry) => {
      if (entry.peerPublicKeyHex !== peerPublicKeyHex) {
        return;
      }
      if (isGroupConversationId(entry.conversationId)) {
        return;
      }
      if (messagingClientOperations.isDmMessageSuppressed(entry.messageId, projection.profileId)) {
        return;
      }
      if (projection.removedMessageIds?.[entry.messageId]) {
        return;
      }
      if (!latest || compareTimelineEntries(entry, latest) > 0) {
        latest = entry;
      }
    });
  });
  return latest;
};

const summarizePeerTimelineActivity = (
  projection: AccountProjectionSnapshot,
  peerPublicKeyHex: PublicKeyHex,
  myPublicKeyHex: PublicKeyHex,
): PeerConversationSummary | null => {
  const latestEntry = findLatestPeerTimelineEntry(projection, peerPublicKeyHex);
  if (!latestEntry) {
    return null;
  }
  const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
  return {
    conversationId,
    lastMessagePreview: toConversationListPreview(latestEntry.plaintextPreview),
    lastMessageAtUnixMs: latestEntry.eventCreatedAtUnixSeconds * 1000,
    unreadCount: 0,
    lastMessageIsOutgoing: latestEntry.direction === "outgoing",
  };
};

const pickNewerPeerSummary = (
  left: PeerConversationSummary | undefined,
  right: PeerConversationSummary | undefined,
): PeerConversationSummary | undefined => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left.lastMessageAtUnixMs >= right.lastMessageAtUnixMs ? left : right;
};

const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  if (isGroupConversationId(params.conversationId)) {
    return null;
  }
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
  if (isGroupConversationId(params.conversationId)) {
    const want = params.conversationId.trim();
    return directTimeline.filter((entry) => entry.conversationId.trim() === want);
  }
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
      if (isGroupConversationId(entry.conversationId)) {
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
  projection: AccountProjectionSnapshot,
  myPublicKeyHex: PublicKeyHex,
): Readonly<Record<string, PeerConversationSummary>> => {
  const byPeer: Record<string, PeerConversationSummary> = {};
  Object.values(projection.conversationsById).forEach((conversation) => {
    const existing = byPeer[conversation.peerPublicKeyHex];
    const candidate: PeerConversationSummary = {
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAtUnixMs: conversation.lastMessageAtUnixMs,
      unreadCount: conversation.unreadCount,
      conversationId: conversation.conversationId,
    };
    byPeer[conversation.peerPublicKeyHex] = pickNewerPeerSummary(existing, candidate) ?? candidate;
  });

  Object.values(projection.contactsByPeer)
    .filter((contact) => contact.status === "accepted")
    .forEach((contact) => {
      const fromTimeline = summarizePeerTimelineActivity(
        projection,
        contact.peerPublicKeyHex,
        myPublicKeyHex,
      );
      if (!fromTimeline) {
        return;
      }
      const existing = byPeer[contact.peerPublicKeyHex];
      const merged = pickNewerPeerSummary(existing, {
        ...fromTimeline,
        unreadCount: existing?.unreadCount ?? fromTimeline.unreadCount,
        conversationId: existing?.conversationId ?? fromTimeline.conversationId,
      });
      if (merged) {
        byPeer[contact.peerPublicKeyHex] = merged;
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
  const latestConversationByPeer = buildLatestConversationByPeer(
    projection,
    projection.accountPublicKeyHex,
  );
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

  const latestConversationByPeer = buildLatestConversationByPeer(
    params.projection,
    params.myPublicKeyHex,
  );
  const contacts = Object.values(params.projection.contactsByPeer)
    .filter((contact) => contact.status === "accepted");

  return contacts
    .map((contact): DmConversation => {
      const conversation = latestConversationByPeer[contact.peerPublicKeyHex];
      const conversationId = [params.myPublicKeyHex, contact.peerPublicKeyHex].sort().join(":");
      return {
        kind: "dm",
        id: conversationId,
        pubkey: contact.peerPublicKeyHex,
        displayName: contact.peerPublicKeyHex.slice(0, 8),
        lastMessage: conversation?.lastMessagePreview ?? "",
        unreadCount: conversation?.unreadCount ?? 0,
        lastMessageTime: new Date(conversation?.lastMessageAtUnixMs ?? 0),
        lastMessageIsOutgoing: conversation?.lastMessageIsOutgoing,
      };
    })
    .sort((left, right) => right.lastMessageTime.getTime() - left.lastMessageTime.getTime());
};

export const selectProjectionConversationMessages = (params: Readonly<{
  projection: AccountProjectionSnapshot | null;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  limit?: number;
}>): ReadonlyArray<Message> => {
  if (!params.projection) {
    return EMPTY_MESSAGES;
  }
  const projection = params.projection;
  const timeline = collectConversationTimelineEntries({
    projection,
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  if (!timeline || timeline.length === 0) {
    return EMPTY_MESSAGES;
  }

  const sortedTimeline = [...timeline]
    .sort((left, right) => {
      if (left.eventCreatedAtUnixSeconds !== right.eventCreatedAtUnixSeconds) {
        return left.eventCreatedAtUnixSeconds - right.eventCreatedAtUnixSeconds;
      }
      return left.messageId.localeCompare(right.messageId);
    });
  const boundedTimeline = (
    typeof params.limit === "number"
    && Number.isFinite(params.limit)
    && params.limit > 0
    && sortedTimeline.length > Math.floor(params.limit)
  )
    ? sortedTimeline.slice(-Math.floor(params.limit))
    : sortedTimeline;

  const profileId = projection.profileId;

  const visibleTimeline = boundedTimeline
    .filter((entry) => !isAccountProjectionTimelineEntrySuppressed(
      entry,
      projection.removedMessageIds,
      profileId,
    ));

  return mapProjectionTimelineToMessages({
    entries: visibleTimeline,
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId,
  });
};

const resolveProjectionMessageContent = (
  messageId: string,
  plaintextPreview: string,
): string => {
  const trimmedPreview = plaintextPreview.trim();
  if (!trimmedPreview) {
    return plaintextPreview;
  }
  try {
    const parsed = normalizeCommunityInvitePayload(JSON.parse(trimmedPreview));
    if (parsed?.type !== "community-invite") {
      return plaintextPreview;
    }
    const merged = applyCommunityInviteMessageSnapshot(messageId, parsed);
    if (!merged) {
      return plaintextPreview;
    }
    const parsedRoomKey = parsed.roomKey.trim();
    const mergedRoomKey = merged.roomKey.trim();
    const needsRoomKeyRepair = mergedRoomKey.length > 0 && parsedRoomKey.length === 0;
    const needsNameRepair = (
      merged.metadata.name.trim().length > 0
      && merged.metadata.name !== parsed.metadata.name
    );
    if (!needsRoomKeyRepair && !needsNameRepair) {
      return plaintextPreview;
    }
    return buildCommunityInvitePlaintext({
      groupId: merged.groupId,
      roomKeyHex: mergedRoomKey || parsedRoomKey,
      metadata: toInviteGroupMetadata(merged.metadata),
      relayUrl: merged.relayUrl,
      communityId: merged.communityId,
      genesisEventId: merged.genesisEventId,
      creatorPubkey: merged.creatorPubkey,
    });
  } catch {
    return plaintextPreview;
  }
};

const mapProjectionTimelineToMessages = (params: Readonly<{
  entries: ReadonlyArray<AccountProjectionSnapshot["messagesByConversationId"][string][number]>;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  profileId: string;
  applyVisibilityFilter?: boolean;
}>): ReadonlyArray<Message> => {
  const mapped = params.entries.map((entry): Message => {
    const isOutgoing = entry.direction === "outgoing";
    return {
      id: entry.messageId,
      kind: "user",
      content: resolveProjectionMessageContent(entry.messageId, entry.plaintextPreview),
      timestamp: new Date(entry.eventCreatedAtUnixSeconds * 1000),
      isOutgoing,
      status: "delivered",
      eventId: entry.messageId,
      eventCreatedAt: new Date(entry.eventCreatedAtUnixSeconds * 1000),
      senderPubkey: isOutgoing ? params.myPublicKeyHex : entry.peerPublicKeyHex,
      recipientPubkey: isOutgoing ? entry.peerPublicKeyHex : params.myPublicKeyHex,
      conversationId: params.conversationId,
    };
  });
  if (params.applyVisibilityFilter === false) {
    return mapped;
  }
  return messagingClientOperations.filterVisibleDmMessages(mapped, params.profileId);
};

/** Locally hidden DM rows still on the projection timeline (v1.5.1 show-again UI). */
export const selectHiddenProjectionConversationMessages = (params: Readonly<{
  projection: AccountProjectionSnapshot | null;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  limit?: number;
}>): ReadonlyArray<Message> => {
  if (!params.projection) {
    return EMPTY_MESSAGES;
  }
  const projection = params.projection;
  const timeline = collectConversationTimelineEntries({
    projection,
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  if (timeline.length === 0) {
    return EMPTY_MESSAGES;
  }

  const sortedTimeline = [...timeline].sort((left, right) => {
    if (left.eventCreatedAtUnixSeconds !== right.eventCreatedAtUnixSeconds) {
      return left.eventCreatedAtUnixSeconds - right.eventCreatedAtUnixSeconds;
    }
    return left.messageId.localeCompare(right.messageId);
  });
  const boundedTimeline = (
    typeof params.limit === "number"
    && Number.isFinite(params.limit)
    && params.limit > 0
    && sortedTimeline.length > Math.floor(params.limit)
  )
    ? sortedTimeline.slice(-Math.floor(params.limit))
    : sortedTimeline;

  const profileId = projection.profileId;
  const hiddenTimeline = boundedTimeline.filter((entry) => (
    isAccountProjectionTimelineEntrySuppressed(
      entry,
      projection.removedMessageIds,
      profileId,
    )
    || messagingClientOperations.isDmMessageSuppressed(entry.messageId, profileId)
  ));

  return mapProjectionTimelineToMessages({
    entries: hiddenTimeline,
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId,
    applyVisibilityFilter: false,
  });
};
