import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { normalizeRelayUrl as normalizeRelayUrlBase } from "@dweb/nostr/relay-utils";
import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";

export type SealedCommunityNostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (
    filters: ReadonlyArray<NostrFilter>,
    onEvent: (event: NostrEvent, url: string) => void,
  ) => string;
  unsubscribe: (id: string) => void;
  publishToUrl?: (url: string, payload: string) => Promise<SealedCommunityPublishResult>;
  publishToUrls?: (
    urls: ReadonlyArray<string>,
    payload: string,
  ) => Promise<SealedCommunityMultiRelayPublishResult>;
  publishToRelay?: (url: string, payload: string) => Promise<SealedCommunityPublishResult>;
  publishToAll: (payload: string) => Promise<SealedCommunityMultiRelayPublishResult>;
}>;

export type SealedCommunityMultiRelayPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: ReadonlyArray<Readonly<{ success: boolean; relayUrl: string; error?: string; latency?: number }>>;
  overallError?: string;
}>;

export type SealedCommunityPublishResult = Readonly<{
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}>;

export const normalizeSealedCommunityRelayUrl = (relayUrl: string): string => {
  const normalized = normalizeRelayUrlBase(relayUrl);
  if (/^[a-z]+:\/\/$/i.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/\/+$/g, "");
};

export const isValidScopedRelayUrl = (relayUrl: string): boolean => (
  hasWritableCommunityRelayTransport(relayUrl)
);

export const toScopedRelayUrl = (relayUrl: string): string | null => (
  isValidScopedRelayUrl(relayUrl) ? normalizeSealedCommunityRelayUrl(relayUrl) : null
);

export const isScopedRelayEvent = (params: Readonly<{
  scopedRelayUrl: string;
  eventRelayUrl: string;
}>): boolean => (
  normalizeSealedCommunityRelayUrl(params.eventRelayUrl)
  === normalizeSealedCommunityRelayUrl(params.scopedRelayUrl)
);

export const hasCommunityBindingTag = (params: Readonly<{
  event: NostrEvent;
  groupId: string;
}>): boolean => {
  const tags = Array.isArray(params.event.tags) ? params.event.tags : [];
  return tags.some((tag) => {
    if (!Array.isArray(tag) || tag.length < 2) {
      return false;
    }
    const key = tag[0];
    const value = tag[1];
    if (typeof key !== "string" || typeof value !== "string") {
      return false;
    }
    if (key !== "h" && key !== "d") {
      return false;
    }
    return value === params.groupId;
  });
};

/** Canonical scoped publish for sealed community control events (primary + optional broadcast relays). */
export const publishSealedEventToCommunityScope = async (params: Readonly<{
  pool: SealedCommunityNostrPool;
  relayUrl: string;
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
  event: NostrEvent;
}>): Promise<SealedCommunityMultiRelayPublishResult> => {
  const payload = JSON.stringify(["EVENT", params.event]);
  const primary = toScopedRelayUrl(params.relayUrl);
  const extras = (params.communityRelayBroadcastUrls ?? [])
    .map((url) => toScopedRelayUrl(url))
    .filter((url): url is string => Boolean(url));
  const targetUrls = Array.from(new Set([
    ...(primary ? [primary] : []),
    ...extras,
  ]));
  if (targetUrls.length === 0) {
    return {
      success: false,
      successCount: 0,
      totalRelays: 0,
      results: [],
      overallError: "no_scoped_relay_configured",
    };
  }

  if (typeof params.pool.publishToUrls === "function") {
    return params.pool.publishToUrls(targetUrls, payload);
  }
  if (typeof params.pool.publishToUrl === "function") {
    const result = await params.pool.publishToUrl(targetUrls[0]!, payload);
    return {
      success: result.success,
      successCount: result.success ? 1 : 0,
      totalRelays: 1,
      results: [result],
      overallError: result.success ? undefined : (result.error ?? "Scoped publish failed"),
    };
  }
  if (typeof params.pool.publishToRelay === "function") {
    const result = await params.pool.publishToRelay(targetUrls[0]!, payload);
    return {
      success: result.success,
      successCount: result.success ? 1 : 0,
      totalRelays: 1,
      results: [result],
      overallError: result.success ? undefined : (result.error ?? "Scoped publish failed"),
    };
  }
  return params.pool.publishToAll(payload);
};
