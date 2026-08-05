import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { normalizeRelayUrl as normalizeRelayUrlBase } from "@dweb/nostr/relay-utils";
import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { normalizeWorkspaceRelayUrl } from "./workspace-relay-url";

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
  /** Present on DM pools; sealed CM publish must never fall through to this. */
  publishToAll?: (payload: string) => Promise<SealedCommunityMultiRelayPublishResult>;
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

export { normalizeWorkspaceRelayUrl } from "./workspace-relay-url";

export const normalizeSealedCommunityRelayUrl = (relayUrl: string): string => (
  normalizeWorkspaceRelayUrl(normalizeRelayUrlBase(relayUrl))
);

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

/**
 * S4: CM publish targets = bound community relay + explicit broadcast URLs only.
 * Never merges DM pool / Quiet public relays into the sealed store.
 */
export const resolveCommunityScopedPublishRelayUrls = (params: Readonly<{
  relayUrl: string;
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const primary = toScopedRelayUrl(params.relayUrl);
  const extras = (params.communityRelayBroadcastUrls ?? [])
    .map((url) => toScopedRelayUrl(url))
    .filter((url): url is string => Boolean(url));
  return Array.from(new Set([
    ...(primary ? [primary] : []),
    ...extras,
  ]));
};

/** Settings / diagnostics copy for the sealed CM store (not DM publish path). */
export const getCommunityScopedRelayCopy = (params: Readonly<{
  relayUrl?: string | null;
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
}>): string => {
  const targets = resolveCommunityScopedPublishRelayUrls({
    relayUrl: params.relayUrl?.trim() ?? "",
    communityRelayBroadcastUrls: params.communityRelayBroadcastUrls,
  });
  if (targets.length === 0) {
    return "CM store: no scoped relay bound — community messages stay on the workspace relay URL, not the DM Quiet pool.";
  }
  const [primary, ...broadcasts] = targets;
  if (broadcasts.length === 0) {
    return `CM store: ${primary} (bound only; DM pool is not used)`;
  }
  return `CM store: ${primary} · broadcast backups: ${broadcasts.join(", ")}`;
};

const failClosedScopedPublish = (params: Readonly<{
  overallError: string;
  targetUrls?: ReadonlyArray<string>;
}>): SealedCommunityMultiRelayPublishResult => ({
  success: false,
  successCount: 0,
  totalRelays: params.targetUrls?.length ?? 0,
  results: (params.targetUrls ?? []).map((relayUrl) => ({
    success: false,
    relayUrl,
    error: params.overallError,
  })),
  overallError: params.overallError,
});

/** Canonical scoped publish for sealed community control events (primary + optional broadcast relays). */
export const publishSealedEventToCommunityScope = async (params: Readonly<{
  pool: SealedCommunityNostrPool;
  relayUrl: string;
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
  event: NostrEvent;
}>): Promise<SealedCommunityMultiRelayPublishResult> => {
  const payload = JSON.stringify(["EVENT", params.event]);
  const targetUrls = resolveCommunityScopedPublishRelayUrls({
    relayUrl: params.relayUrl,
    communityRelayBroadcastUrls: params.communityRelayBroadcastUrls,
  });
  if (targetUrls.length === 0) {
    return failClosedScopedPublish({ overallError: "no_scoped_relay_configured" });
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

  // S4: never fall through to publishToAll — that would fan out to the DM pool and
  // break the sealed shared-store invariant (C1/C2).
  return failClosedScopedPublish({
    overallError: "scoped_publish_api_unavailable",
    targetUrls,
  });
};
