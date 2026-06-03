import type { Message } from "../types";
import {
  auditProfileScopedStorageAccess,
  buildProfileScopedConversationCacheKey,
  type ProfileScopedConversationCacheKey,
} from "./progressive-cache-tier-policy";

/** Global cap — keeps nav cache warm without unbounded memory. */
export const DM_THREAD_DISPLAY_CACHE_MAX_ENTRIES = 48;

const displayCache = new Map<ProfileScopedConversationCacheKey, ReadonlyArray<Message>>();
const cacheTouchOrder: ProfileScopedConversationCacheKey[] = [];
const listeners = new Set<() => void>();

const touchCacheEntry = (key: ProfileScopedConversationCacheKey): void => {
  const index = cacheTouchOrder.indexOf(key);
  if (index >= 0) {
    cacheTouchOrder.splice(index, 1);
  }
  cacheTouchOrder.push(key);
  while (cacheTouchOrder.length > DM_THREAD_DISPLAY_CACHE_MAX_ENTRIES) {
    const evictKey = cacheTouchOrder.shift();
    if (!evictKey) {
      break;
    }
    displayCache.delete(evictKey);
  }
};

const toKey = buildProfileScopedConversationCacheKey;

export const readDmThreadDisplayCache = (
  profileId: string | undefined,
  conversationId: string | undefined,
): ReadonlyArray<Message> | null => {
  const key = toKey(profileId, conversationId);
  if (!key) {
    return null;
  }
  const cached = displayCache.get(key) ?? null;
  if (cached) {
    touchCacheEntry(key);
  }
  return cached;
};

export const writeDmThreadDisplayCache = (
  profileId: string | undefined,
  conversationId: string | undefined,
  messages: ReadonlyArray<Message>,
): void => {
  const audit = auditProfileScopedStorageAccess({
    profileId,
    conversationId,
    operation: "write",
  });
  if (!audit.ok || messages.length === 0) {
    return;
  }
  const key = toKey(profileId, conversationId);
  if (!key) {
    return;
  }
  displayCache.set(key, messages);
  touchCacheEntry(key);
  listeners.forEach((listener) => listener());
};

export const subscribeDmThreadDisplayCache = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Test-only reset. */
export const resetDmThreadDisplayCacheForTests = (): void => {
  displayCache.clear();
  cacheTouchOrder.length = 0;
  listeners.clear();
};
