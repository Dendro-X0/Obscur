import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { TRUST_BANNER_DISMISS_COOLDOWN_MS } from "./dm-kernel-trust-assessment-port";

const STORAGE_ROOT = "obscur.dm_kernel_trust_thread_state.v1";

type ThreadTrustState = Readonly<{
  firstPeerMessageAtUnixMs: number | null;
  dismissedUntilUnixMs: number | null;
}>;

const DEFAULT_STATE: ThreadTrustState = {
  firstPeerMessageAtUnixMs: null,
  dismissedUntilUnixMs: null,
};

type StoredTrustStateByConversation = Readonly<Record<string, ThreadTrustState>>;

const readStore = (profileId: string): StoredTrustStateByConversation => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_ROOT, profileId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as StoredTrustStateByConversation;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (profileId: string, store: StoredTrustStateByConversation): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_ROOT, profileId), JSON.stringify(store));
  } catch {
    // Best-effort local recipient state only.
  }
};

export const resolveTrustThreadStateKey = (
  conversationId: string,
  conversationKind: "dm" | "group",
  senderPublicKeyHex: string | undefined,
): string => {
  if (conversationKind === "group" && senderPublicKeyHex) {
    return `${conversationId}#${senderPublicKeyHex}`;
  }
  return conversationId;
};

export const getDmTrustThreadState = (
  profileId: string,
  conversationId: string,
): ThreadTrustState => readStore(profileId)[conversationId] ?? DEFAULT_STATE;

export const recordPeerIncomingMessage = (
  profileId: string,
  conversationId: string,
  timestampUnixMs: number,
): ThreadTrustState => {
  const store = { ...readStore(profileId) };
  const current = store[conversationId] ?? DEFAULT_STATE;
  const next: ThreadTrustState = {
    ...current,
    firstPeerMessageAtUnixMs: current.firstPeerMessageAtUnixMs ?? timestampUnixMs,
  };
  store[conversationId] = next;
  writeStore(profileId, store);
  return next;
};

export const dismissDmTrustBanner = (
  profileId: string,
  conversationId: string,
  nowUnixMs: number = Date.now(),
): ThreadTrustState => {
  const store = { ...readStore(profileId) };
  const current = store[conversationId] ?? DEFAULT_STATE;
  const next: ThreadTrustState = {
    ...current,
    dismissedUntilUnixMs: nowUnixMs + TRUST_BANNER_DISMISS_COOLDOWN_MS,
  };
  store[conversationId] = next;
  writeStore(profileId, store);
  return next;
};

/** Clears recipient-local thread trust state (Dev Lab / manual matrix reset). */
export const clearDmTrustThreadState = (
  profileId: string,
  conversationId: string,
): void => {
  const store = { ...readStore(profileId) };
  if (conversationId in store) {
    delete store[conversationId];
    writeStore(profileId, store);
  }
};
