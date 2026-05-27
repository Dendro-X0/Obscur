import type { Message } from "../types";

type ProfileConversationKey = `${string}::${string}`;

const displayCache = new Map<ProfileConversationKey, ReadonlyArray<Message>>();
const listeners = new Set<() => void>();

const toKey = (profileId: string, conversationId: string): ProfileConversationKey => (
  `${profileId.trim()}::${conversationId.trim()}`
);

export const readDmThreadDisplayCache = (
  profileId: string | undefined,
  conversationId: string | undefined,
): ReadonlyArray<Message> | null => {
  if (!profileId?.trim() || !conversationId?.trim()) {
    return null;
  }
  return displayCache.get(toKey(profileId, conversationId)) ?? null;
};

export const writeDmThreadDisplayCache = (
  profileId: string | undefined,
  conversationId: string | undefined,
  messages: ReadonlyArray<Message>,
): void => {
  if (!profileId?.trim() || !conversationId?.trim() || messages.length === 0) {
    return;
  }
  displayCache.set(toKey(profileId, conversationId), messages);
  listeners.forEach((listener) => listener());
};

export const subscribeDmThreadDisplayCache = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Test-only reset. */
export const resetDmThreadDisplayCacheForTests = (): void => {
  displayCache.clear();
  listeners.clear();
};
