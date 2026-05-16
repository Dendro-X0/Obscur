/**
 * Single contract for "is this message identity locally suppressed (delete for me / tombstone)?"
 *
 * R1 slice: all in-process hydration and projection selection should use the same
 * id + eventId rule against the durable suppressed-id set and store-backed checks.
 */

import { messagingClientOperations } from "./messaging-client-operations";

export type MessageLikeIdentity = Readonly<{
  id: string;
  eventId?: string | null;
  relayPublishedEventId?: string | null;
}>;

/** True if `id` or `eventId` (when present) appears in the in-memory suppressed set. */
export const isMessageIdentityInSuppressedIdSet = (
  message: MessageLikeIdentity,
  suppressedIds: ReadonlySet<string>,
): boolean => {
  const id = message.id?.trim() ?? "";
  if (id.length > 0 && suppressedIds.has(id)) {
    return true;
  }
  const eventId = message.eventId?.trim() ?? "";
  if (eventId.length > 0 && suppressedIds.has(eventId)) {
    return true;
  }
  const relayPublishedEventId = message.relayPublishedEventId?.trim() ?? "";
  return relayPublishedEventId.length > 0 && suppressedIds.has(relayPublishedEventId);
};

export type AccountProjectionTimelineEntry = Readonly<{
  messageId: string;
}>;

/**
 * Projection timeline entries only carry `messageId` (used as both id and synthetic eventId downstream).
 */
export const isAccountProjectionTimelineEntrySuppressed = (
  entry: AccountProjectionTimelineEntry,
  removedMessageIds: Readonly<Record<string, number>> | undefined,
  profileId: string,
  nowMs: number = Date.now(),
): boolean => {
  const tombstonedAt = removedMessageIds?.[entry.messageId] ?? 0;
  if (tombstonedAt > 0) {
    return true;
  }
  return messagingClientOperations.isDmMessageSuppressed(entry.messageId, profileId, nowMs);
};
