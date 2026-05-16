import type { Message } from "../types";
import type { MessageBusEvent } from "./message-bus";
import { recordDmDelete } from "../dm-ledger";
import { toDeletedMessageIdentityIds } from "./dm-conversation-delete-identity-ids";
import { normalizeDmConversationMessageRow } from "./dm-conversation-normalize-message";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import { messagingClientOperations } from "./messaging-client-operations";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const LIVE_WINDOW_SOFT_LIMIT = 200;
const DELETE_TOMBSTONE_TTL_MS = 2 * 60 * 1000;

export type DeleteTombstones = Map<string, number>;

export type ApplyRealtimeBufferedEventsParams = Readonly<{
  previous: ReadonlyArray<Message>;
  events: ReadonlyArray<MessageBusEvent>;
  chatPerformanceV2Enabled: boolean;
  allowExpandedHistory: boolean;
  tombstones?: DeleteTombstones;
  nowMs?: number;
  myPublicKeyHex?: string | null;
  persistentSuppressedMessageIds?: ReadonlySet<string>;
  liveWindowSoftLimit?: number;
}>;

export { toDeletedMessageIdentityIds } from "./dm-conversation-delete-identity-ids";

const removeMessagesByIdentityIds = (
  messagesById: Map<string, Message>,
  identityIds: ReadonlyArray<string>,
): void => {
  if (identityIds.length === 0) {
    return;
  }
  const toDelete = new Set(identityIds);
  Array.from(messagesById.entries()).forEach(([messageId, message]) => {
    if (
      toDelete.has(messageId)
      || (!!message.eventId && toDelete.has(message.eventId))
      || (!!message.relayPublishedEventId && toDelete.has(message.relayPublishedEventId))
    ) {
      messagesById.delete(messageId);
    }
  });
};

/** Canonical realtime merge for DM thread lists (message bus → visible messages). */
export const applyRealtimeBufferedEvents = (
  params: ApplyRealtimeBufferedEventsParams,
): ReadonlyArray<Message> => {
  const {
    previous,
    events,
    chatPerformanceV2Enabled,
    allowExpandedHistory,
    tombstones,
    nowMs = Date.now(),
    myPublicKeyHex,
    persistentSuppressedMessageIds,
    liveWindowSoftLimit = LIVE_WINDOW_SOFT_LIMIT,
  } = params;

  const profileId = getResolvedProfileId() || undefined;
  if (tombstones && tombstones.size > 0) {
    for (const [id, deletedAt] of tombstones.entries()) {
      if (nowMs - deletedAt > DELETE_TOMBSTONE_TTL_MS
        && !messagingClientOperations.isDmMessageSuppressed(id, profileId, nowMs)) {
        tombstones.delete(id);
      }
    }
  }

  const byId = new Map<string, Message>();
  const eventIdToKey = new Map<string, string>();
  previous.forEach((message) => {
    byId.set(message.id, message);
    if (message.eventId) {
      eventIdToKey.set(message.eventId, message.id);
    }
  });

  events.forEach((event) => {
    if (event.type === "message_deleted") {
      if (event.messageId === "all") {
        byId.clear();
        eventIdToKey.clear();
        tombstones?.clear();
      } else {
        const deleteIds = toDeletedMessageIdentityIds(event);
        removeMessagesByIdentityIds(byId, deleteIds);
        deleteIds.forEach((deleteId) => {
          tombstones?.set(deleteId, nowMs);
          eventIdToKey.delete(deleteId);
        });

        if (myPublicKeyHex) {
          void (async () => {
            try {
              await recordDmDelete({
                conversationId: event.conversationId,
                targetIdentityIds: deleteIds,
                deletedByPubkey: myPublicKeyHex,
                isLocalDelete: true,
                source: "local_delete",
              });
            } catch (err) {
              console.error("[dm-ledger:shadow] record delete error", err);
            }
          })();
        }
      }
      return;
    }

    if (event.message.kind === "command") {
      byId.delete(event.message.id);
      return;
    }

    const memoryTombstoned = (
      tombstones?.has(event.message.id)
      || (event.message.eventId ? tombstones?.has(event.message.eventId) : false)
    );
    if (memoryTombstoned) {
      return;
    }
    if (
      messagingClientOperations.isDmMessageIdentitySuppressed(event.message, profileId, nowMs)
    ) {
      return;
    }
    if (
      persistentSuppressedMessageIds
      && isMessageIdentityInSuppressedIdSet(event.message, persistentSuppressedMessageIds)
    ) {
      return;
    }

    const normalized = normalizeDmConversationMessageRow(event.message, {
      conversationId: event.conversationId,
      myPublicKeyHex,
    });
    const existingKey = event.message.eventId ? eventIdToKey.get(event.message.eventId) : undefined;
    if (existingKey && existingKey !== event.message.id) {
      byId.delete(existingKey);
    }
    byId.set(event.message.id, normalized);
    if (event.message.eventId) {
      eventIdToKey.set(event.message.eventId, event.message.id);
    }
  });

  const sorted = Array.from(byId.values()).sort((left, right) => (
    left.timestamp.getTime() - right.timestamp.getTime()
  ));
  const suppressedIds = persistentSuppressedMessageIds ?? new Set<string>();
  const visible = sorted.filter((message) => (
    isDisplayableDmConversationMessage(message)
    && !isMessageIdentityInSuppressedIdSet(message, suppressedIds)
    && !messagingClientOperations.isDmMessageIdentitySuppressed(message, profileId, nowMs)
  ));
  if (chatPerformanceV2Enabled && !allowExpandedHistory && visible.length > liveWindowSoftLimit) {
    return visible.slice(-liveWindowSoftLimit);
  }
  return visible;
};

/** @deprecated Use `applyRealtimeBufferedEvents` or gateway port. */
export const applyBufferedEvents = (
  previous: ReadonlyArray<Message>,
  events: ReadonlyArray<MessageBusEvent>,
  chatPerformanceV2Enabled: boolean,
  allowExpandedHistory: boolean,
  tombstones?: DeleteTombstones,
  nowMs?: number,
  myPublicKeyHex?: string | null,
  persistentSuppressedMessageIds?: ReadonlySet<string>,
): ReadonlyArray<Message> => applyRealtimeBufferedEvents({
  previous,
  events,
  chatPerformanceV2Enabled,
  allowExpandedHistory,
  tombstones,
  nowMs,
  myPublicKeyHex,
  persistentSuppressedMessageIds,
});
