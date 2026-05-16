/**
 * R1 — unified DM thread suppression id set for materialization.
 * Merges durable delete tombstones with account projection removals.
 */

import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";

export const buildDmThreadSuppressionIdSet = (params: Readonly<{
  durableSuppressedIds: ReadonlySet<string>;
  projection: AccountProjectionSnapshot | null | undefined;
}>): ReadonlySet<string> => {
  const merged = new Set<string>();
  params.durableSuppressedIds.forEach((id) => {
    const normalized = id.trim();
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  });
  const removed = params.projection?.removedMessageIds ?? {};
  Object.keys(removed).forEach((messageId) => {
    const normalized = messageId.trim();
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  });
  return merged;
};

export const persistedMessagesContainSuppressedIdentities = (
  messages: ReadonlyArray<Readonly<{ id: string; eventId?: string | null }>>,
  suppressedIds: ReadonlySet<string>,
): boolean => {
  if (suppressedIds.size === 0 || messages.length === 0) {
    return false;
  }
  return messages.some((message) => {
    const id = message.id?.trim() ?? "";
    if (id.length > 0 && suppressedIds.has(id)) {
      return true;
    }
    const eventId = message.eventId?.trim() ?? "";
    return eventId.length > 0 && suppressedIds.has(eventId);
  });
};
