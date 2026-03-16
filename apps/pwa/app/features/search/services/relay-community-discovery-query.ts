"use client";

import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import type { RelayQueryPool } from "./relay-discovery-query";

export type RelayCommunityRecord = Readonly<{
  communityId: string;
  relayUrl: string;
  name?: string;
  about?: string;
  picture?: string;
  access?: "open" | "invite-only" | "discoverable";
  updatedAtUnixMs: number;
}>;

type QueryRelayCommunitiesParams = Readonly<{
  pool: RelayQueryPool;
  query: string;
  timeoutMs?: number;
  maxResults?: number;
}>;

const QUERY_TIMEOUT_MS = 6_500;
const COMMUNITY_WINDOW_SECONDS = 60 * 60 * 24 * 180;

const normalize = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildFilters = (query: string): ReadonlyArray<NostrFilter> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return [
    { kinds: [39000], search: query, limit: 80 },
    { kinds: [39000], since: nowSeconds - COMMUNITY_WINDOW_SECONDS, limit: 260 },
  ];
};

const parseCommunityEvent = (params: Readonly<{
  relayUrl: string;
  event: Readonly<{ tags?: unknown }>;
}>): RelayCommunityRecord | null => {
  if (!Array.isArray(params.event.tags)) return null;
  const tags = params.event.tags.filter(Array.isArray) as string[][];
  const communityId = normalize(tags.find((tag) => tag[0] === "d")?.[1]);
  if (!communityId) return null;

  const name = normalize(tags.find((tag) => tag[0] === "name")?.[1]);
  const about = normalize(tags.find((tag) => tag[0] === "about")?.[1]);
  const picture = normalize(tags.find((tag) => tag[0] === "picture")?.[1]);
  const isPrivate = tags.some((tag) => tag[0] === "private");
  const isClosed = tags.some((tag) => tag[0] === "closed");
  const access: RelayCommunityRecord["access"] = isClosed || isPrivate ? "invite-only" : "open";
  return {
    communityId,
    relayUrl: params.relayUrl,
    name,
    about,
    picture,
    access,
    updatedAtUnixMs: Date.now(),
  };
};

const matchesQuery = (record: RelayCommunityRecord, query: string): boolean => {
  const q = query.toLowerCase();
  if (record.communityId.toLowerCase().includes(q)) return true;
  if ((record.name ?? "").toLowerCase().includes(q)) return true;
  if ((record.about ?? "").toLowerCase().includes(q)) return true;
  if (record.relayUrl.toLowerCase().includes(q)) return true;
  return false;
};

export const relayCommunityDiscoveryInternals = {
  buildFilters,
  parseCommunityEvent,
  matchesQuery,
};

export const queryRelayCommunities = async (
  params: QueryRelayCommunitiesParams
): Promise<ReadonlyArray<RelayCommunityRecord>> => {
  const query = params.query.trim();
  if (!query) {
    return [];
  }
  const timeoutMs = params.timeoutMs ?? QUERY_TIMEOUT_MS;
  const maxResults = params.maxResults ?? 120;
  const subId = `discover-community-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filters = buildFilters(query);
  const results = new Map<string, RelayCommunityRecord>();
  await params.pool.waitForConnection(2_500);

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;

    const finalize = (): void => {
      if (settled) return;
      settled = true;
      try {
        params.pool.sendToOpen(JSON.stringify(["CLOSE", subId]));
      } catch {
        // ignore close failures
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      resolve(Array.from(results.values()));
    };

    unsubscribe = params.pool.subscribeToMessages(({ url, message }) => {
      if (settled) return;
      try {
        const parsed = JSON.parse(message);
        if (!Array.isArray(parsed)) return;
        if (parsed[0] !== "EVENT" || parsed[1] !== subId) return;
        const event = parsed[2];
        if (!event || typeof event !== "object" || event.kind !== 39000) return;
        const record = parseCommunityEvent({ relayUrl: url, event });
        if (!record || !matchesQuery(record, query)) return;
        const key = `${record.relayUrl}:${record.communityId}`;
        results.set(key, record);
        if (results.size >= maxResults) {
          finalize();
        }
      } catch {
        // Ignore malformed messages.
      }
    });

    void params.pool.broadcastEvent(JSON.stringify(["REQ", subId, ...filters]));
    setTimeout(finalize, timeoutMs);
  });
};
