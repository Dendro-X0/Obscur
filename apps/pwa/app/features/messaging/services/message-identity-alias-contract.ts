import type { Message, PersistedMessage } from "@/app/features/messaging/types";

type MessageIdentityLike = Readonly<{
  id?: unknown;
  eventId?: unknown;
}>;

const normalizeIdentityValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const collectMessageIdentityAliases = (
  message: MessageIdentityLike | Message | PersistedMessage,
): ReadonlyArray<string> => {
  const ids = new Set<string>();
  const messageId = normalizeIdentityValue(message.id);
  const eventId = normalizeIdentityValue(message.eventId);
  const relayPublishedEventId = normalizeIdentityValue(
    "relayPublishedEventId" in message ? (message as { relayPublishedEventId?: unknown }).relayPublishedEventId : undefined,
  );
  if (messageId) {
    ids.add(messageId);
  }
  if (eventId) {
    ids.add(eventId);
  }
  if (relayPublishedEventId) {
    ids.add(relayPublishedEventId);
  }
  return Array.from(ids);
};
