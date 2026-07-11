/**
 * Single owner for community invite DM lifecycle (send, persist, thread bus, ledger, responses).
 * All invite/accept/decline paths must go through this module.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { MessageQueue, type Message as QueueMessage } from "@/app/features/messaging/lib/message-queue";
import { messagingChatStateMessagePort } from "@/app/features/messaging/services/messaging-chat-state-message-port";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import type { Message, PersistedMessage } from "@/app/features/messaging/types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { isTauri, dbInsertMessage, dbUpsertConversation } from "@dweb/db";
import type { ConversationRecord, MessageRecord } from "@dweb/db";
import { appendCanonicalDmEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { toAccountEventPlaintextPreview } from "@/app/features/account-sync/services/account-event-plaintext-preview";
import { pinCommunityInviteMessageSnapshotForMessage } from "../utils/community-invite-message-snapshot";
import { buildCommunityInviteResponseStatusByMessageId } from "../utils/community-invite-resolution";
import type { InviteResponseStatus } from "@/app/features/messaging/components/message-list-render-meta";
import { normalizeCommunityInvitePayload } from "../utils/community-invite-payload";
import {
  buildCommunityInviteResponseWirePlaintext,
  buildCommunityInviteWirePlaintext,
  createCommunityDmInviteId,
  parseCommunityInviteResponseWirePayload,
  parseCommunityInviteWirePayload,
  parseMessageContentJson,
  type CommunityDmInviteId,
  type CommunityInviteResolutionStatus,
  type CommunityInviteResponseWirePayload,
  type CommunityInviteWirePayload,
} from "./community-dm-invite-contract";
import {
  findCommunityDmInviteLedgerEntry,
  inferCommunityDmInviteLedgerWireParties,
  isCommunityDmInviteLedgerInviterForViewer,
  listCommunityDmInviteLedgerForConversation,
  updateCommunityDmInviteLedgerStatus,
  upsertCommunityDmInviteLedgerEntry,
  type CommunityDmInviteLedgerEntry,
} from "./community-dm-invite-ledger";

export const COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT = "obscur:community-dm-invite-ledger-changed";

export type CommitOutboundCommunityDmInviteParams = Readonly<{
  inviteId: CommunityDmInviteId;
  invitePayload: CommunityInviteWirePayload;
  dmMessage: Message;
  accountPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>;

const resolveCanonicalThreadMessageId = (message: Message): string => (
  message.eventId?.trim() || message.id.trim()
);

export const toCanonicalCommunityDmInviteThreadMessage = (message: Message): Message => {
  const canonicalMessageId = resolveCanonicalThreadMessageId(message);
  const giftWrapId = message.id.trim();
  const relayPublishedEventId = (
    typeof message.relayPublishedEventId === "string" && message.relayPublishedEventId.trim().length > 0
  )
    ? message.relayPublishedEventId.trim()
    : (giftWrapId !== canonicalMessageId ? giftWrapId : undefined);
  return {
    ...message,
    id: canonicalMessageId,
    eventId: canonicalMessageId,
    ...(relayPublishedEventId ? { relayPublishedEventId } : {}),
  } as Message;
};

const toPersistedInviteMessage = (message: Message): PersistedMessage => ({
  id: resolveCanonicalThreadMessageId(message),
  eventId: message.eventId,
  kind: message.kind,
  content: message.content,
  timestampMs: message.timestamp.getTime(),
  isOutgoing: message.isOutgoing === true,
  status: message.status,
  pubkey: typeof message.senderPubkey === "string" ? message.senderPubkey : undefined,
});

const persistInviteToChatState = (
  message: Message,
  accountPublicKeyHex: PublicKeyHex,
  profileId: string,
): void => {
  const conversationId = message.conversationId?.trim();
  if (!conversationId) {
    return;
  }
  const persistedMessage = toPersistedInviteMessage(message);
  const chatState = messagingChatStateMessagePort.load(accountPublicKeyHex, { profileId });
  const existing = chatState?.messagesByConversationId?.[conversationId] ?? [];
  if (existing.some((entry) => entry.id === persistedMessage.id)) {
    return;
  }
  messagingChatStateMessagePort.updateMessages(accountPublicKeyHex, {
    [conversationId]: [...existing, persistedMessage],
  });
};

const persistInviteToNativeSqlite = async (
  message: Message,
  profileId: string,
): Promise<void> => {
  const conversationId = message.conversationId?.trim();
  const eventId = resolveCanonicalThreadMessageId(message);
  if (!conversationId || !eventId) {
    return;
  }
  const record: MessageRecord = {
    event_id: eventId,
    profile_id: profileId,
    conversation_id: conversationId,
    sender_pubkey: typeof message.senderPubkey === "string" ? message.senderPubkey : "",
    recipient_pubkey: typeof message.recipientPubkey === "string" ? message.recipientPubkey : "",
    plaintext: typeof message.content === "string" ? message.content : "",
    kind: typeof message.kind === "number" ? message.kind : 4,
    created_at: Math.floor(message.timestamp.getTime() / 1000),
    received_at: message.timestamp.getTime(),
    is_outgoing: message.isOutgoing === true,
    reply_to_event_id: null,
    has_attachment: false,
  };
  await dbInsertMessage(record).catch(() => undefined);
  const peerPubkey = message.isOutgoing === true
    ? (typeof message.recipientPubkey === "string" ? message.recipientPubkey : "")
    : (typeof message.senderPubkey === "string" ? message.senderPubkey : "");
  const convRec: ConversationRecord = {
    id: conversationId,
    profile_id: profileId,
    peer_pubkey: peerPubkey,
    last_event_id: record.event_id,
    last_message_at: message.timestamp.getTime(),
    last_plaintext_preview: toAccountEventPlaintextPreview(message.content),
    unread_count: 0,
  };
  await dbUpsertConversation(convRec).catch(() => undefined);
};

const notifyLedgerChanged = (conversationId: string, profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT, {
    detail: { conversationId, profileId },
  }));
};

/** Outbound invite: persist + bus + ledger (single pathway for inviter thread). */
export const commitOutboundCommunityDmInvite = async (
  params: CommitOutboundCommunityDmInviteParams,
): Promise<Message> => {
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  const canonicalMessage = toCanonicalCommunityDmInviteThreadMessage(params.dmMessage);
  const conversationId = canonicalMessage.conversationId?.trim();
  const recipientPubkey = canonicalMessage.recipientPubkey?.trim();
  if (!conversationId || !recipientPubkey) {
    return canonicalMessage;
  }

  const persistedMessage = { ...canonicalMessage, conversationId } as Message;
  const queueMessage = { ...persistedMessage, conversationId } as QueueMessage;

  pinCommunityInviteMessageSnapshotForMessage(
    persistedMessage,
    normalizeCommunityInvitePayload(params.invitePayload),
  );

  persistInviteToChatState(persistedMessage, params.accountPublicKeyHex, profileId);

  const mq = new MessageQueue(params.accountPublicKeyHex);
  await mq.persistMessage(queueMessage);

  messageBus.emitNewMessage(conversationId, persistedMessage, { sourceProfileId: profileId });
  await messagePersistenceService.flushPendingNow();

  upsertCommunityDmInviteLedgerEntry({
    inviteId: params.inviteId,
    conversationId,
    peerPubkey: recipientPubkey as PublicKeyHex,
    inviterPubkey: params.accountPublicKeyHex,
    inviteePubkey: recipientPubkey as PublicKeyHex,
    direction: "outbound",
    groupId: params.invitePayload.groupId,
    groupName: params.invitePayload.metadata.name,
    communityId: params.invitePayload.communityId,
    relayUrl: params.invitePayload.relayUrl,
    invitePayload: params.invitePayload,
    status: "pending",
    sentAtUnixMs: canonicalMessage.timestamp.getTime(),
    updatedAtUnixMs: Date.now(),
    rumorEventId: canonicalMessage.eventId,
  }, profileId, params.accountPublicKeyHex);

  notifyLedgerChanged(conversationId, profileId);

  // Best-effort projection evidence — must not block invite UX (matches dm-controller:v2).
  void appendCanonicalDmEvent({
    profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    peerPublicKeyHex: recipientPubkey as PublicKeyHex,
    type: "DM_SENT_CONFIRMED",
    conversationId,
    messageId: resolveCanonicalThreadMessageId(canonicalMessage),
    eventCreatedAtUnixSeconds: Math.floor(canonicalMessage.timestamp.getTime() / 1000),
    plaintextPreview: toAccountEventPlaintextPreview(canonicalMessage.content),
    idempotencySuffix: params.inviteId,
    source: "local_bootstrap",
  }).catch((error) => {
    logAppEvent({
      name: "groups.community_invite_projection_append_failed",
      level: "warn",
      scope: { feature: "groups", action: "invite_dm_projection" },
      context: {
        conversationId,
        inviteId: params.inviteId,
        reason: error instanceof Error ? error.message : String(error),
      },
    });
  });

  return canonicalMessage;
};

export type BuildCommunityInviteResponseMessageParams = Readonly<{
  inviteId: CommunityDmInviteId;
  status: Exclude<CommunityInviteResolutionStatus, "pending">;
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  conversationId: string;
  senderPubkey: PublicKeyHex;
  recipientPubkey: PublicKeyHex;
  replyToRumorEventId: string;
  timestamp?: Date;
}>;

export const buildCommunityInviteResponseDmMessage = (
  params: BuildCommunityInviteResponseMessageParams,
): Message => {
  const responsePayload: CommunityInviteResponseWirePayload = {
    type: "community-invite-response",
    inviteId: params.inviteId,
    status: params.status,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
  };
  const timestamp = params.timestamp ?? new Date();
  const content = buildCommunityInviteResponseWirePlaintext(responsePayload);
  return {
    id: `${params.inviteId}:${params.status}:${timestamp.getTime()}`,
    conversationId: params.conversationId,
    kind: "user",
    content,
    timestamp,
    isOutgoing: true,
    status: "delivered",
    senderPubkey: params.senderPubkey,
    recipientPubkey: params.recipientPubkey,
    replyTo: { messageId: params.replyToRumorEventId, previewText: "" },
  };
};

/** Record terminal response on ledger + optional inbound copy (after DM send succeeds). */
export const recordCommunityDmInviteResponse = (params: Readonly<{
  inviteId: CommunityDmInviteId;
  status: Exclude<CommunityInviteResolutionStatus, "pending">;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  direction: "outbound" | "inbound";
  invitePayload?: CommunityInviteWirePayload;
  profileId?: string;
  accountPublicKeyHex?: PublicKeyHex | null;
}>): CommunityDmInviteLedgerEntry | null => {
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  let entry = findCommunityDmInviteLedgerEntry(params.inviteId, profileId, params.accountPublicKeyHex);
  if (!entry && params.invitePayload) {
    const wireParties = inferCommunityDmInviteLedgerWireParties({
      peerPubkey: params.peerPubkey,
      direction: params.direction,
      invitePayload: params.invitePayload,
      accountPublicKeyHex: params.accountPublicKeyHex,
    });
    if (!wireParties) {
      return null;
    }
    upsertCommunityDmInviteLedgerEntry({
      inviteId: params.inviteId,
      conversationId: params.conversationId,
      peerPubkey: params.peerPubkey,
      inviterPubkey: wireParties.inviterPubkey,
      inviteePubkey: wireParties.inviteePubkey,
      direction: params.direction,
      groupId: params.invitePayload.groupId,
      groupName: params.invitePayload.metadata.name,
      communityId: params.invitePayload.communityId,
      relayUrl: params.invitePayload.relayUrl,
      invitePayload: params.invitePayload,
      status: params.status,
      sentAtUnixMs: Date.now(),
      updatedAtUnixMs: Date.now(),
    }, profileId, params.accountPublicKeyHex);
    entry = findCommunityDmInviteLedgerEntry(params.inviteId, profileId, params.accountPublicKeyHex);
  }
  const updated = updateCommunityDmInviteLedgerStatus({
    inviteId: params.inviteId,
    status: params.status,
    profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
  notifyLedgerChanged(params.conversationId, profileId);
  return updated ?? entry;
};

/** Inviter receives peer response DM — update ledger by inviteId. */
export const applyInboundCommunityDmInviteResponse = (params: Readonly<{
  responsePayload: CommunityInviteResponseWirePayload;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  profileId?: string;
  accountPublicKeyHex?: PublicKeyHex | null;
  invitePayload?: CommunityInviteWirePayload;
}>): void => {
  recordCommunityDmInviteResponse({
    inviteId: params.responsePayload.inviteId,
    status: params.responsePayload.status,
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    direction: "outbound",
    invitePayload: params.invitePayload,
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
};

/** Invitee receives terminal response (e.g. cancel) — update inbound ledger row. */
export const applyInboundCommunityDmInviteTerminalResponse = (params: Readonly<{
  responsePayload: CommunityInviteResponseWirePayload;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  profileId?: string;
  accountPublicKeyHex?: PublicKeyHex | null;
  invitePayload?: CommunityInviteWirePayload;
}>): void => {
  recordCommunityDmInviteResponse({
    inviteId: params.responsePayload.inviteId,
    status: params.responsePayload.status,
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    direction: "inbound",
    invitePayload: params.invitePayload,
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
};

/** Seed or update invite ledger when an inbound wire row arrives on the active DM thread. */
export const syncCommunityDmInviteLedgerFromInboundMessage = (params: Readonly<{
  message: Pick<Message, "content" | "senderPubkey" | "eventId">;
  conversationId: string;
  accountPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>): void => {
  const sender = params.message.senderPubkey?.trim();
  if (!sender || sender === params.accountPublicKeyHex.trim()) {
    return;
  }
  const peerPubkey = sender as PublicKeyHex;

  const response = parseInviteResponsePayloadFromMessageContent(params.message.content ?? "");
  if (response) {
    applyInboundCommunityDmInviteTerminalResponse({
      responsePayload: response,
      conversationId: params.conversationId,
      peerPubkey,
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
    });
    return;
  }

  const invite = parseInvitePayloadFromMessageContent(params.message.content ?? "");
  if (invite) {
    applyInboundCommunityDmInvite({
      invitePayload: invite,
      conversationId: params.conversationId,
      peerPubkey,
      accountPublicKeyHex: params.accountPublicKeyHex,
      rumorEventId: params.message.eventId,
      profileId: params.profileId,
    });
  }
};

/** Invitee receives invite DM — seed inbound ledger row. */
export const applyInboundCommunityDmInvite = (params: Readonly<{
  invitePayload: CommunityInviteWirePayload;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  accountPublicKeyHex: PublicKeyHex;
  rumorEventId?: string;
  profileId?: string;
}>): void => {
  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  upsertCommunityDmInviteLedgerEntry({
    inviteId: params.invitePayload.inviteId,
    conversationId: params.conversationId,
    peerPubkey: params.peerPubkey,
    inviterPubkey: params.peerPubkey,
    inviteePubkey: params.accountPublicKeyHex,
    direction: "inbound",
    groupId: params.invitePayload.groupId,
    groupName: params.invitePayload.metadata.name,
    communityId: params.invitePayload.communityId,
    relayUrl: params.invitePayload.relayUrl,
    invitePayload: params.invitePayload,
    status: "pending",
    sentAtUnixMs: Date.now(),
    updatedAtUnixMs: Date.now(),
    rumorEventId: params.rumorEventId,
  }, profileId, params.accountPublicKeyHex);
  notifyLedgerChanged(params.conversationId, profileId);
};

export const parseInvitePayloadFromMessageContent = (
  content: string,
): CommunityInviteWirePayload | null => (
  parseCommunityInviteWirePayload(parseMessageContentJson(content))
);

export const parseInviteResponsePayloadFromMessageContent = (
  content: string,
): CommunityInviteResponseWirePayload | null => (
  parseCommunityInviteResponseWirePayload(parseMessageContentJson(content))
);

/** Status for thread UI: inviteId → resolution (messages + ledger). */
export const buildCommunityDmInviteStatusByInviteId = (
  messages: ReadonlyArray<Message>,
  conversationId: string,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyMap<CommunityDmInviteId, CommunityInviteResolutionStatus> => {
  const statusByInviteId = new Map<CommunityDmInviteId, CommunityInviteResolutionStatus>();

  listCommunityDmInviteLedgerForConversation(conversationId, profileId, accountPublicKeyHex).forEach((entry) => {
    statusByInviteId.set(entry.inviteId, entry.status);
  });

  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (response) {
      statusByInviteId.set(response.inviteId, response.status);
    }
  });

  return statusByInviteId;
};

/** @deprecated IRA-3 — display threads must not inject ledger rows; ledger drives status only. */
export const buildSyntheticOutboundInviteMessages = (
  conversationId: string,
  existingMessages: ReadonlyArray<Message>,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyArray<Message> => {
  const existingInviteIds = new Set<CommunityDmInviteId>();
  existingMessages.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (invite) {
      existingInviteIds.add(invite.inviteId);
    }
  });

  const synthetic: Message[] = [];
  listCommunityDmInviteLedgerForConversation(conversationId, profileId, accountPublicKeyHex).forEach((entry) => {
    if (!isCommunityDmInviteLedgerInviterForViewer(entry, accountPublicKeyHex) || existingInviteIds.has(entry.inviteId)) {
      return;
    }
    synthetic.push({
      id: `ledger-invite:${entry.inviteId}`,
      conversationId: entry.conversationId,
      kind: "user",
      content: buildCommunityInviteWirePlaintext(entry.invitePayload),
      timestamp: new Date(entry.sentAtUnixMs),
      isOutgoing: true,
      status: "delivered",
      eventId: entry.rumorEventId ?? `ledger-invite:${entry.inviteId}`,
      senderPubkey: entry.inviterPubkey,
      recipientPubkey: entry.inviteePubkey,
    });
  });

  return synthetic;
};

const isLedgerSyntheticInviteMessage = (message: Message): boolean => (
  message.id.startsWith("ledger-invite:")
);

const toInviteMessageUnixMs = (message: Message): number => (
  message.eventCreatedAt?.getTime() ?? message.timestamp.getTime()
);

type CommunityInviteThreadIndex = Readonly<{
  inviteByInviteId: ReadonlyMap<CommunityDmInviteId, Message>;
  inviteByGroupId: ReadonlyMap<string, Message>;
  inviteGroupIdByInviteId: ReadonlyMap<CommunityDmInviteId, string>;
}>;

const buildCommunityInviteThreadIndex = (
  messages: ReadonlyArray<Message>,
): CommunityInviteThreadIndex => {
  const inviteByInviteId = new Map<CommunityDmInviteId, Message>();
  const inviteByGroupId = new Map<string, Message>();
  const inviteGroupIdByInviteId = new Map<CommunityDmInviteId, string>();

  messages.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite?.groupId) {
      return;
    }
    inviteByGroupId.set(invite.groupId, message);
    inviteGroupIdByInviteId.set(invite.inviteId, invite.groupId);
    if (!invite.inviteId.startsWith("legacy:")) {
      inviteByInviteId.set(invite.inviteId, message);
    }
  });

  return { inviteByInviteId, inviteByGroupId, inviteGroupIdByInviteId };
};

const resolveLinkedInviteForResponse = (
  response: Readonly<{ inviteId: CommunityDmInviteId; groupId: string }>,
  index: CommunityInviteThreadIndex,
): Message | undefined => (
  index.inviteByInviteId.get(response.inviteId)
  ?? index.inviteByGroupId.get(response.groupId)
);

const isPeerAcceptDeclineResponse = (
  status: string,
): status is "accepted" | "declined" => status === "accepted" || status === "declined";

/** Accept/decline direction must match invite role (inviter sees incoming; invitee sees outgoing). */
export const filterMisdirectedCommunityInviteResponses = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<Message> => {
  const index = buildCommunityInviteThreadIndex(messages);
  return messages.filter((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response || !isPeerAcceptDeclineResponse(response.status)) {
      return true;
    }
    const linkedInvite = resolveLinkedInviteForResponse(response, index);
    if (!linkedInvite) {
      return true;
    }
    if (linkedInvite.isOutgoing) {
      return message.isOutgoing !== true;
    }
    return message.isOutgoing === true;
  });
};

const pickPreferredResponseDuplicate = (
  candidate: Message,
  incumbent: Message,
  index: CommunityInviteThreadIndex,
): Message => {
  const candidateResponse = parseInviteResponsePayloadFromMessageContent(candidate.content);
  const incumbentResponse = parseInviteResponsePayloadFromMessageContent(incumbent.content);
  if (!candidateResponse || !incumbentResponse) {
    return incumbent;
  }
  const linkedInvite = resolveLinkedInviteForResponse(candidateResponse, index);
  if (!linkedInvite) {
    return toInviteMessageUnixMs(candidate) >= toInviteMessageUnixMs(incumbent)
      ? candidate
      : incumbent;
  }
  const candidateCorrect = linkedInvite.isOutgoing
    ? candidate.isOutgoing !== true
    : candidate.isOutgoing === true;
  const incumbentCorrect = linkedInvite.isOutgoing
    ? incumbent.isOutgoing !== true
    : incumbent.isOutgoing === true;
  if (candidateCorrect !== incumbentCorrect) {
    return candidateCorrect ? candidate : incumbent;
  }
  return toInviteMessageUnixMs(candidate) >= toInviteMessageUnixMs(incumbent)
    ? candidate
    : incumbent;
};

/** Collapse duplicate accept/decline rows that share groupId but mismatched inviteId aliases. */
export const dedupeCommunityInviteResponseMessagesByGroupAndStatus = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<Message> => {
  const index = buildCommunityInviteThreadIndex(messages);
  const latestByGroupStatus = new Map<string, Message>();
  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response || !isPeerAcceptDeclineResponse(response.status) || !response.groupId) {
      return;
    }
    const key = `${response.groupId}:${response.status}`;
    const existing = latestByGroupStatus.get(key);
    if (!existing) {
      latestByGroupStatus.set(key, message);
      return;
    }
    latestByGroupStatus.set(
      key,
      pickPreferredResponseDuplicate(message, existing, index),
    );
  });
  if (latestByGroupStatus.size === 0) {
    return messages;
  }
  const keepIds = new Set(Array.from(latestByGroupStatus.values(), (entry) => entry.id));
  return messages.filter((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response || !isPeerAcceptDeclineResponse(response.status) || !response.groupId) {
      return true;
    }
    return keepIds.has(message.id);
  });
};

const responseMatchesTerminalInvite = (
  response: Readonly<{ inviteId: CommunityDmInviteId; groupId: string }>,
  terminalInviteIds: ReadonlySet<CommunityDmInviteId>,
  inviteGroupIdByInviteId: ReadonlyMap<CommunityDmInviteId, string>,
): boolean => {
  if (terminalInviteIds.has(response.inviteId)) {
    return true;
  }
  return Array.from(terminalInviteIds).some(
    (inviteId) => inviteGroupIdByInviteId.get(inviteId) === response.groupId,
  );
};

const responseOrphanedFromThreadInvites = (
  response: Readonly<{ inviteId: CommunityDmInviteId; groupId: string }>,
  inviteIdsInThread: ReadonlySet<CommunityDmInviteId>,
  inviteGroupIdByInviteId: ReadonlyMap<CommunityDmInviteId, string>,
): boolean => {
  if (inviteIdsInThread.has(response.inviteId)) {
    return false;
  }
  const responseGroupId = response.groupId;
  if (!responseGroupId) {
    return true;
  }
  return !Array.from(inviteIdsInThread).some(
    (inviteId) => inviteGroupIdByInviteId.get(inviteId) === responseGroupId,
  );
};

const pickPreferredInviteDuplicate = (candidate: Message, incumbent: Message): Message => {
  const candidateSynthetic = isLedgerSyntheticInviteMessage(candidate);
  const incumbentSynthetic = isLedgerSyntheticInviteMessage(incumbent);
  if (candidateSynthetic !== incumbentSynthetic) {
    return candidateSynthetic ? incumbent : candidate;
  }
  const candidateHasSender = Boolean(candidate.senderPubkey?.trim());
  const incumbentHasSender = Boolean(incumbent.senderPubkey?.trim());
  if (candidateHasSender !== incumbentHasSender) {
    return candidateHasSender ? candidate : incumbent;
  }
  return toInviteMessageUnixMs(candidate) >= toInviteMessageUnixMs(incumbent)
    ? candidate
    : incumbent;
};

/** Keep one terminal response row per inviteId (latest wins). */
export const dedupeCommunityInviteResponseMessagesByInviteId = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<Message> => {
  const latestByInviteId = new Map<CommunityDmInviteId, Message>();
  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response) {
      return;
    }
    const existing = latestByInviteId.get(response.inviteId);
    if (!existing || toInviteMessageUnixMs(message) >= toInviteMessageUnixMs(existing)) {
      latestByInviteId.set(response.inviteId, message);
    }
  });
  if (latestByInviteId.size === 0) {
    return messages;
  }
  const keepIds = new Set(Array.from(latestByInviteId.values(), (entry) => entry.id));
  return messages.filter((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response) {
      return true;
    }
    return keepIds.has(message.id);
  });
};

/** Collapse duplicate hydrate copies that share the same stable inviteId. */
export const dedupeCommunityInviteThreadMessagesByInviteId = (
  messages: ReadonlyArray<Message>,
): ReadonlyArray<Message> => {
  const newestByInviteId = new Map<CommunityDmInviteId, Message>();
  messages.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite?.inviteId || invite.inviteId.startsWith("legacy:")) {
      return;
    }
    const existing = newestByInviteId.get(invite.inviteId);
    if (!existing) {
      newestByInviteId.set(invite.inviteId, message);
      return;
    }
    newestByInviteId.set(invite.inviteId, pickPreferredInviteDuplicate(message, existing));
  });
  if (newestByInviteId.size === 0) {
    return messages;
  }
  const keepMessageIds = new Set(Array.from(newestByInviteId.values(), (entry) => entry.id));
  return messages.filter((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite?.inviteId || invite.inviteId.startsWith("legacy:")) {
      return true;
    }
    return keepMessageIds.has(message.id);
  });
};

export type CommitCommunityDmInviteResponseParams = Readonly<{
  responseMessage: Message;
  accountPublicKeyHex: PublicKeyHex;
  direction: "outbound" | "inbound";
  invitePayload?: CommunityInviteWirePayload;
  profileId?: string;
}>;

/** Terminal invite response: persist + bus + ledger (single pathway after DM send). */
export const commitCommunityDmInviteResponseDm = async (
  params: CommitCommunityDmInviteResponseParams,
): Promise<Message> => {
  const responsePayload = parseInviteResponsePayloadFromMessageContent(params.responseMessage.content);
  if (!responsePayload) {
    throw new Error("commitCommunityDmInviteResponseDm: message is not a terminal community invite response");
  }

  const profileId = params.profileId?.trim() || getResolvedProfileId().trim();
  const canonicalMessage = toCanonicalCommunityDmInviteThreadMessage(params.responseMessage);
  const conversationId = canonicalMessage.conversationId?.trim();
  const peerPubkey = (
    params.direction === "outbound"
      ? canonicalMessage.recipientPubkey
      : canonicalMessage.senderPubkey
  )?.trim();
  if (!conversationId || !peerPubkey) {
    return canonicalMessage;
  }

  const persistedMessage = { ...canonicalMessage, conversationId } as Message;
  const queueMessage = { ...persistedMessage, conversationId } as QueueMessage;

  persistInviteToChatState(persistedMessage, params.accountPublicKeyHex, profileId);

  const mq = new MessageQueue(params.accountPublicKeyHex);
  await mq.persistMessage(queueMessage);

  messageBus.emitNewMessage(conversationId, persistedMessage, { sourceProfileId: profileId });
  await messagePersistenceService.flushPendingNow();

  if (isTauri() && profileId) {
    await persistInviteToNativeSqlite(persistedMessage, profileId);
  }

  recordCommunityDmInviteResponse({
    inviteId: responsePayload.inviteId,
    status: responsePayload.status,
    conversationId,
    peerPubkey: peerPubkey as PublicKeyHex,
    direction: params.direction,
    invitePayload: params.invitePayload,
    profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });

  return canonicalMessage;
};

/** Merge ledger outbound invites and hide response rows already bound to an invite card. */
export const normalizeCommunityInviteThreadSenderPubkeys = (
  messages: ReadonlyArray<Message>,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyArray<Message> => {
  const localSenderPubkey = accountPublicKeyHex?.trim();
  if (!localSenderPubkey) {
    return messages;
  }
  return messages.map((message) => {
    if (message.senderPubkey?.trim() || !message.isOutgoing) {
      return message;
    }
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite) {
      return message;
    }
    return { ...message, senderPubkey: localSenderPubkey as PublicKeyHex };
  });
};

export type CommunityInviteThreadDisplayBundle = Readonly<{
  messages: ReadonlyArray<Message>;
  inviteResponseStatusByMessageId: ReadonlyMap<string, InviteResponseStatus>;
}>;

const buildCommunityInviteThreadDisplayCore = (
  messages: ReadonlyArray<Message>,
  conversationId: string,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): CommunityInviteThreadDisplayBundle => {
  const normalizedMessages = normalizeCommunityInviteThreadSenderPubkeys(messages, accountPublicKeyHex);
  const dedupedMessages = dedupeCommunityInviteThreadMessagesByInviteId(normalizedMessages);
  const dedupedResponsesByInviteId = dedupeCommunityInviteResponseMessagesByInviteId(dedupedMessages);
  const dedupedResponses = dedupeCommunityInviteResponseMessagesByGroupAndStatus(dedupedResponsesByInviteId);
  const roleFilteredResponses = filterMisdirectedCommunityInviteResponses(dedupedResponses);
  const inviteIndex = buildCommunityInviteThreadIndex(roleFilteredResponses);
  const inviteIdsInThread = new Set<CommunityDmInviteId>();
  roleFilteredResponses.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (invite) {
      inviteIdsInThread.add(invite.inviteId);
    }
  });

  const inviteStatusByMessageId = buildCommunityInviteResponseStatusByMessageId(
    roleFilteredResponses,
    conversationId,
    profileId,
    accountPublicKeyHex,
  );
  const terminalInviteIds = new Set<CommunityDmInviteId>();
  roleFilteredResponses.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite) {
      return;
    }
    const status = inviteStatusByMessageId.get(message.id);
    if (status && status !== "pending") {
      terminalInviteIds.add(invite.inviteId);
    }
  });

  const displayMessages = roleFilteredResponses.filter((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response) {
      return true;
    }
    if (responseMatchesTerminalInvite(
      response,
      terminalInviteIds,
      inviteIndex.inviteGroupIdByInviteId,
    )) {
      return false;
    }
    return responseOrphanedFromThreadInvites(
      response,
      inviteIdsInThread,
      inviteIndex.inviteGroupIdByInviteId,
    );
  });

  return {
    messages: displayMessages,
    inviteResponseStatusByMessageId: inviteStatusByMessageId,
  };
};

/** Status overlay + display rows — exposes terminal status before response rows are hidden. */
export const buildCommunityInviteThreadDisplayBundle = buildCommunityInviteThreadDisplayCore;

/** Status overlay: dedupe invites/responses and hide terminal response rows bound to invite cards. */
export const augmentCommunityDmInviteThreadMessages = (
  messages: ReadonlyArray<Message>,
  conversationId: string,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyArray<Message> => (
  buildCommunityInviteThreadDisplayCore(messages, conversationId, profileId, accountPublicKeyHex).messages
);

export { createCommunityDmInviteId };
