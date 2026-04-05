"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { syncCheckpointInternals } from "@/app/features/messaging/lib/sync-checkpoints";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";
import { readHistoryResetCutoffUnixMs } from "./history-reset-cutoff-store";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";
import type { AccountEvent, AccountEventSource } from "../account-event-contracts";

const toPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 140)}...`;
};

const toSourceCounts = (
  events: ReadonlyArray<AccountEvent>
): Readonly<Record<AccountEventSource, number>> => {
  const initial: Record<AccountEventSource, number> = {
    local_bootstrap: 0,
    relay_live: 0,
    relay_sync: 0,
    legacy_bridge: 0,
  };
  events.forEach((entry) => {
    initial[entry.source] += 1;
  });
  return initial;
};

const createCommonEvent = <TType extends AccountEvent["type"]>(params: Readonly<{
  type: TType;
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  idempotencyKey: string;
  eventId: string;
  source?: AccountEventSource;
  observedAtUnixMs?: number;
}>): Readonly<{
  type: TType;
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  idempotencyKey: string;
  eventId: string;
  source: AccountEventSource;
  observedAtUnixMs: number;
}> => ({
  ...params,
  source: params.source ?? "local_bootstrap",
  observedAtUnixMs: params.observedAtUnixMs ?? Date.now(),
});

const createBootstrapMarkerEvent = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  sourceCounts: Readonly<Record<AccountEventSource, number>>;
  dedupeCount: number;
}>): AccountEvent => ({
  ...createCommonEvent({
    type: "BOOTSTRAP_IMPORT_APPLIED",
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    idempotencyKey: "bootstrap_import_applied:v1",
    eventId: "bootstrap_import_applied:v1",
  }),
  sourceCounts: params.sourceCounts,
  dedupeCount: params.dedupeCount,
});

const pushRequestStatusEvent = (
  result: AccountEvent[],
  params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    peerPublicKeyHex: PublicKeyHex;
    status: "pending" | "accepted" | "declined" | "canceled";
    isOutgoing: boolean;
    eventId?: string;
    timestampUnixMs: number;
    source: AccountEventSource;
    idempotencyPrefix: string;
  }>
): void => {
  const base = createCommonEvent({
    type: params.status === "pending"
      ? (params.isOutgoing ? "CONTACT_REQUEST_SENT" : "CONTACT_REQUEST_RECEIVED")
      : params.status === "accepted"
        ? "CONTACT_ACCEPTED"
        : params.status === "declined"
          ? "CONTACT_DECLINED"
          : "CONTACT_CANCELED",
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    idempotencyKey: `${params.idempotencyPrefix}:request:${params.peerPublicKeyHex}:${params.status}:${params.isOutgoing ? "out" : "in"}:${params.timestampUnixMs}`,
    eventId: params.eventId ?? `${params.idempotencyPrefix}_request_${params.peerPublicKeyHex}_${params.timestampUnixMs}`,
    source: params.source,
  });
  result.push({
    ...base,
    peerPublicKeyHex: params.peerPublicKeyHex,
    direction: params.isOutgoing ? "outgoing" : "incoming",
    requestEventId: params.eventId,
    observedAtUnixMs: params.timestampUnixMs || base.observedAtUnixMs,
  });
};

const pushMessageEvent = (
  result: AccountEvent[],
  params: Readonly<{
    profileId: string;
    accountPublicKeyHex: PublicKeyHex;
    conversationId: string;
    peerPublicKeyHex: PublicKeyHex;
    messageId: string;
    plaintext: string;
    timestampUnixMs: number;
    isOutgoing: boolean;
    source: AccountEventSource;
    idempotencyPrefix: string;
  }>
): void => {
  const eventType = params.isOutgoing ? "DM_SENT_CONFIRMED" : "DM_RECEIVED";
  result.push({
    ...createCommonEvent({
      type: eventType,
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      idempotencyKey: `${params.idempotencyPrefix}:dm:${params.conversationId}:${params.messageId}:${eventType}`,
      eventId: params.messageId,
      source: params.source,
    }),
    peerPublicKeyHex: params.peerPublicKeyHex,
    conversationId: params.conversationId,
    messageId: params.messageId,
    eventCreatedAtUnixSeconds: Math.floor(params.timestampUnixMs / 1000),
    plaintextPreview: toPreview(params.plaintext),
    observedAtUnixMs: params.timestampUnixMs || Date.now(),
  });
};

const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  accountPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const normalizedConversationId = params.conversationId.trim();
  const directPeer = normalizePublicKeyHex(normalizedConversationId);
  if (directPeer && directPeer !== params.accountPublicKeyHex) {
    return directPeer;
  }

  const parts = normalizedConversationId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const [leftRaw, rightRaw] = parts;
  const left = normalizePublicKeyHex(leftRaw);
  const right = normalizePublicKeyHex(rightRaw);
  if (!left || !right) {
    return null;
  }
  if (left === params.accountPublicKeyHex && right !== params.accountPublicKeyHex) {
    return right;
  }
  if (right === params.accountPublicKeyHex && left !== params.accountPublicKeyHex) {
    return left;
  }
  return null;
};

const resolvePeerPublicKeyHex = (params: Readonly<{
  conversationId: string;
  messagePubkey?: string;
  inferredConversationPeer: PublicKeyHex | null;
  conversationPeerById: ReadonlyMap<string, PublicKeyHex>;
  accountPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const fromConversation = params.conversationPeerById.get(params.conversationId);
  if (fromConversation) {
    return fromConversation;
  }

  const fromConversationId = inferPeerFromConversationId({
    conversationId: params.conversationId,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
  if (fromConversationId) {
    return fromConversationId;
  }

  if (params.inferredConversationPeer) {
    return params.inferredConversationPeer;
  }

  const messagePubkey = normalizePublicKeyHex(params.messagePubkey);
  if (messagePubkey && messagePubkey !== params.accountPublicKeyHex) {
    return messagePubkey;
  }

  return null;
};

const resolveMessageIsOutgoing = (params: Readonly<{
  message: Readonly<{ isOutgoing?: unknown; pubkey?: unknown }>;
  accountPublicKeyHex: PublicKeyHex;
}>): boolean => {
  const messagePubkey = normalizePublicKeyHex(
    typeof params.message.pubkey === "string" ? params.message.pubkey : undefined
  );
  if (messagePubkey === params.accountPublicKeyHex) {
    return true;
  }
  if (messagePubkey && messagePubkey !== params.accountPublicKeyHex) {
    return false;
  }
  return typeof params.message.isOutgoing === "boolean"
    ? params.message.isOutgoing
    : false;
};

const isCommandMessage = (message: Readonly<{
  kind?: unknown;
  content?: unknown;
}>): boolean => (
  message.kind === "command"
  || (typeof message.content === "string" && parseCommandMessage(message.content) !== null)
);

const toDeleteTargetMessageIds = (messages: ReadonlyArray<Readonly<{
  content?: unknown;
}>>): ReadonlySet<string> => {
  const ids = new Set<string>();
  messages.forEach((message) => {
    if (typeof message.content !== "string") {
      return;
    }
    const parsed = parseCommandMessage(message.content);
    if (!parsed || parsed.type !== "delete") {
      return;
    }
    const targetMessageId = parsed.targetMessageId.trim();
    if (targetMessageId.length > 0) {
      ids.add(targetMessageId);
    }
  });
  return ids;
};

const collectFromChatState = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  events: AccountEvent[];
  chatState: ReturnType<typeof chatStateStoreService.load>;
  source: AccountEventSource;
  idempotencyPrefix: string;
  historyResetCutoffUnixMs?: number | null;
}>): void => {
  const chatState = params.chatState;
  if (!chatState) {
    return;
  }
  const conversationPeerById = new Map<string, PublicKeyHex>();
  (chatState.createdConnections ?? []).forEach((connection) => {
    const normalizedPeer = normalizePublicKeyHex(connection.pubkey);
    if (!normalizedPeer) {
      return;
    }
    conversationPeerById.set(connection.id, normalizedPeer);
  });
  (chatState.connectionRequests ?? []).forEach((request) => {
    const peerPublicKeyHex = request.id as PublicKeyHex;
    pushRequestStatusEvent(params.events, {
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      peerPublicKeyHex,
      status: request.status,
      isOutgoing: request.isOutgoing,
      eventId: request.eventId,
      timestampUnixMs: request.timestampMs,
      source: params.source,
      idempotencyPrefix: params.idempotencyPrefix,
    });
  });
  Object.entries(chatState.messagesByConversationId).forEach(([conversationId, messages]) => {
    const deleteTargetMessageIds = toDeleteTargetMessageIds(messages as ReadonlyArray<Readonly<{ content?: unknown }>>);
    const inferredConversationPeer = messages.reduce<PublicKeyHex | null>((resolved, message) => {
      if (resolved) {
        return resolved;
      }
      const messagePubkey = normalizePublicKeyHex(message.pubkey);
      if (!messagePubkey || messagePubkey === params.accountPublicKeyHex) {
        return null;
      }
      return messagePubkey;
    }, null);
    messages.forEach((message) => {
      if (isCommandMessage(message)) {
        return;
      }
      const messageId = typeof message.id === "string" ? message.id.trim() : "";
      const messageEventId = typeof (message as { eventId?: unknown }).eventId === "string"
        ? ((message as { eventId?: string }).eventId ?? "").trim()
        : "";
      if ((messageId && deleteTargetMessageIds.has(messageId)) || (messageEventId && deleteTargetMessageIds.has(messageEventId))) {
        return;
      }
      if (
        typeof params.historyResetCutoffUnixMs === "number"
        && Number.isFinite(params.historyResetCutoffUnixMs)
        && message.timestampMs < params.historyResetCutoffUnixMs
      ) {
        return;
      }
      const isOutgoing = resolveMessageIsOutgoing({
        message,
        accountPublicKeyHex: params.accountPublicKeyHex,
      });
      const peerPublicKeyHex = resolvePeerPublicKeyHex({
        conversationId,
        messagePubkey: message.pubkey,
        inferredConversationPeer,
        conversationPeerById,
        accountPublicKeyHex: params.accountPublicKeyHex,
      });
      if (!peerPublicKeyHex) {
        return;
      }
      if (!messageId) {
        return;
      }
      pushMessageEvent(params.events, {
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        conversationId,
        peerPublicKeyHex,
        messageId,
        plaintext: message.content,
        timestampUnixMs: message.timestampMs,
        isOutgoing,
        source: params.source,
        idempotencyPrefix: params.idempotencyPrefix,
      });
    });
  });
};

const collectFromBackupPayload = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  events: AccountEvent[];
  payload: EncryptedAccountBackupPayload;
  source: AccountEventSource;
  idempotencyPrefix: string;
  historyResetCutoffUnixMs?: number | null;
}>): void => {
  params.payload.peerTrust.acceptedPeers.forEach((peerPublicKeyHex) => {
    params.events.push({
      ...createCommonEvent({
        type: "CONTACT_ACCEPTED",
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        idempotencyKey: `${params.idempotencyPrefix}:accepted:${peerPublicKeyHex}`,
        eventId: `${params.idempotencyPrefix}_contact_accepted_${peerPublicKeyHex}`,
        source: params.source,
      }),
      peerPublicKeyHex,
      direction: "unknown",
    });
  });
  collectFromChatState({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events: params.events,
    chatState: params.payload.chatState,
    source: params.source,
    idempotencyPrefix: params.idempotencyPrefix,
    historyResetCutoffUnixMs: params.historyResetCutoffUnixMs,
  });
  params.payload.syncCheckpoints.forEach((checkpoint) => {
    if (
      typeof params.historyResetCutoffUnixMs === "number"
      && Number.isFinite(params.historyResetCutoffUnixMs)
      && checkpoint.updatedAtUnixMs < params.historyResetCutoffUnixMs
    ) {
      return;
    }
    params.events.push({
      ...createCommonEvent({
        type: "SYNC_CHECKPOINT_ADVANCED",
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        idempotencyKey: `${params.idempotencyPrefix}:checkpoint:${checkpoint.timelineKey}:${checkpoint.lastProcessedAtUnixSeconds}`,
        eventId: `${params.idempotencyPrefix}_checkpoint_${checkpoint.timelineKey}_${checkpoint.lastProcessedAtUnixSeconds}`,
        source: params.source,
      }),
      timelineKey: checkpoint.timelineKey,
      lastProcessedAtUnixSeconds: checkpoint.lastProcessedAtUnixSeconds,
      observedAtUnixMs: checkpoint.updatedAtUnixMs,
    });
  });
};

export const buildCanonicalBackupImportEvents = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  payload: EncryptedAccountBackupPayload;
  source?: AccountEventSource;
  idempotencyPrefix?: string;
}>): ReadonlyArray<AccountEvent> => {
  const source = params.source ?? "relay_sync";
  const idempotencyPrefix = params.idempotencyPrefix ?? `restore:${params.payload.createdAtUnixMs}`;
  const historyResetCutoffUnixMs = readHistoryResetCutoffUnixMs(params.profileId);
  const events: AccountEvent[] = [];
  collectFromBackupPayload({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events,
    payload: params.payload,
    source,
    idempotencyPrefix,
    historyResetCutoffUnixMs,
  });
  return events;
};

export const buildBootstrapAccountEvents = async (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  backupPayload?: EncryptedAccountBackupPayload | null;
}>): Promise<Readonly<{
  events: ReadonlyArray<AccountEvent>;
  sourceCounts: Readonly<Record<AccountEventSource, number>>;
}>> => {
  const historyResetCutoffUnixMs = readHistoryResetCutoffUnixMs(params.profileId);
  await chatStateStoreService.hydrateMessages(params.accountPublicKeyHex);
  const events: AccountEvent[] = [];
  const peerTrust = peerTrustInternals.loadFromStorage(params.accountPublicKeyHex);
  const chatState = chatStateStoreService.load(params.accountPublicKeyHex);
  const checkpoints = Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values());

  peerTrust.acceptedPeers.forEach((peerPublicKeyHex) => {
    events.push({
      ...createCommonEvent({
        type: "CONTACT_ACCEPTED",
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        idempotencyKey: `legacy:accepted:${peerPublicKeyHex}`,
        eventId: `legacy_contact_accepted_${peerPublicKeyHex}`,
      }),
      peerPublicKeyHex,
      direction: "unknown",
    });
  });

  collectFromChatState({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    events,
    chatState,
    source: "local_bootstrap",
    idempotencyPrefix: "legacy",
    historyResetCutoffUnixMs,
  });

  checkpoints.forEach((checkpoint) => {
    if (
      typeof historyResetCutoffUnixMs === "number"
      && Number.isFinite(historyResetCutoffUnixMs)
      && checkpoint.updatedAtUnixMs < historyResetCutoffUnixMs
    ) {
      return;
    }
    events.push({
      ...createCommonEvent({
        type: "SYNC_CHECKPOINT_ADVANCED",
        profileId: params.profileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
        idempotencyKey: `legacy:checkpoint:${checkpoint.timelineKey}:${checkpoint.lastProcessedAtUnixSeconds}`,
        eventId: `legacy_checkpoint_${checkpoint.timelineKey}_${checkpoint.lastProcessedAtUnixSeconds}`,
      }),
      timelineKey: checkpoint.timelineKey,
      lastProcessedAtUnixSeconds: checkpoint.lastProcessedAtUnixSeconds,
      observedAtUnixMs: checkpoint.updatedAtUnixMs,
    });
  });

  if (params.backupPayload) {
    collectFromBackupPayload({
      profileId: params.profileId,
      accountPublicKeyHex: params.accountPublicKeyHex,
      events,
      payload: params.backupPayload,
      source: "local_bootstrap",
      idempotencyPrefix: "backup",
      historyResetCutoffUnixMs,
    });
  }

  const sourceCounts = toSourceCounts(events);
  events.push(createBootstrapMarkerEvent({
    profileId: params.profileId,
    accountPublicKeyHex: params.accountPublicKeyHex,
    sourceCounts,
    dedupeCount: 0,
  }));

  return {
    events,
    sourceCounts,
  };
};
