import type { MessageBusEvent } from "./message-bus";

/** Identity ids for a `message_deleted` bus event (R1 helper; not the realtime materialization port). */
export const toDeletedMessageIdentityIds = (
  event: Extract<MessageBusEvent, { type: "message_deleted" }>,
): ReadonlyArray<string> => {
  const ids = new Set<string>();
  const primaryId = event.messageId.trim();
  if (primaryId.length > 0) {
    ids.add(primaryId);
  }
  (event.messageIdentityIds ?? []).forEach((value) => {
    const normalized = value.trim();
    if (normalized.length > 0) {
      ids.add(normalized);
    }
  });
  return Array.from(ids);
};
