import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";

type ThreadSessionEntry = Readonly<{
  messages: ReadonlyArray<Message>;
  cachedAtUnixMs: number;
}>;

const threadSessionCache = new Map<string, ThreadSessionEntry>();
let busInvalidationInstalled = false;

const cacheKey = (profileId: string, conversationId: string): string => (
  `${profileId.trim()}:${conversationId.trim()}`
);

const invalidateConversation = (conversationId: string): void => {
  const trimmed = conversationId.trim();
  if (!trimmed) {
    return;
  }
  const suffix = `:${trimmed}`;
  for (const key of [...threadSessionCache.keys()]) {
    if (key.endsWith(suffix) || key.includes(`:${trimmed}:`)) {
      threadSessionCache.delete(key);
    }
  }
};

export const ensureDmKernelThreadSessionCacheInvalidation = (): void => {
  if (busInvalidationInstalled || typeof window === "undefined") {
    return;
  }
  busInvalidationInstalled = true;
  messageBus.subscribe((event) => {
    if (
      event.type === "new_message"
      || event.type === "message_updated"
      || event.type === "message_deleted"
    ) {
      invalidateConversation(event.conversationId);
    }
  });
};

export const readDmKernelThreadSessionCache = (
  profileId: string,
  conversationId: string,
): ReadonlyArray<Message> | null => {
  const entry = threadSessionCache.get(cacheKey(profileId, conversationId));
  return entry ? [...entry.messages] : null;
};

export const writeDmKernelThreadSessionCache = (
  profileId: string,
  conversationId: string,
  messages: ReadonlyArray<Message>,
): void => {
  threadSessionCache.set(cacheKey(profileId, conversationId), {
    messages: [...messages],
    cachedAtUnixMs: Date.now(),
  });
};

export const invalidateDmKernelThreadSessionCache = (
  profileId: string,
  conversationId: string,
): void => {
  threadSessionCache.delete(cacheKey(profileId, conversationId));
  invalidateConversation(conversationId);
};

export const clearDmKernelThreadSessionCacheForTests = (): void => {
  threadSessionCache.clear();
  busInvalidationInstalled = false;
};
