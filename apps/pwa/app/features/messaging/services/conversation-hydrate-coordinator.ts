/**
 * Coalesces redundant DM history hydrates (nav retries, index rebuild, route focus).
 */

const DEFAULT_DEBOUNCE_MS = 220;

type PendingEntry = Readonly<{
  timerId: ReturnType<typeof setTimeout>;
}>;

const pendingByKey = new Map<string, PendingEntry>();

const toKey = (profileId: string, conversationId: string): string => (
  `${profileId.trim()}::${conversationId.trim()}`
);

export const scheduleCoalescedConversationHydrate = (
  profileId: string | undefined,
  conversationId: string | undefined,
  run: () => void,
  options?: Readonly<{ debounceMs?: number; immediate?: boolean }>,
): void => {
  if (!profileId?.trim() || !conversationId?.trim()) {
    return;
  }
  const key = toKey(profileId, conversationId);
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
  if (!profileId?.trim() || !conversationId?.trim()) {
    return;
  }
  const key = toKey(profileId, conversationId);
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
