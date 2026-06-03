/**
 * Coalesces redundant DM history hydrates (nav retries, index rebuild, route focus).
 */

import { buildProfileScopedConversationCacheKey } from "./progressive-cache-tier-policy";

const DEFAULT_DEBOUNCE_MS = 220;

type PendingEntry = Readonly<{
  timerId: ReturnType<typeof setTimeout>;
}>;

const pendingByKey = new Map<string, PendingEntry>();

const toKey = buildProfileScopedConversationCacheKey;

export const scheduleCoalescedConversationHydrate = (
  profileId: string | undefined,
  conversationId: string | undefined,
  run: () => void,
  options?: Readonly<{ debounceMs?: number; immediate?: boolean }>,
): void => {
  const key = toKey(profileId, conversationId);
  if (!key) {
    return;
  }
  const existing = pendingByKey.get(key);
  if (existing) {
    clearTimeout(existing.timerId);
    pendingByKey.delete(key);
  }
  if (options?.immediate) {
    run();
    return;
  }
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const timerId = setTimeout(() => {
    pendingByKey.delete(key);
    run();
  }, debounceMs);
  pendingByKey.set(key, { timerId });
};

export const cancelCoalescedConversationHydrate = (
  profileId: string | undefined,
  conversationId: string | undefined,
): void => {
  const key = toKey(profileId, conversationId);
  if (!key) {
    return;
  }
  const existing = pendingByKey.get(key);
  if (!existing) {
    return;
  }
  clearTimeout(existing.timerId);
  pendingByKey.delete(key);
};

/** Test-only reset. */
export const resetConversationHydrateCoordinatorForTests = (): void => {
  pendingByKey.forEach((entry) => clearTimeout(entry.timerId));
  pendingByKey.clear();
};
