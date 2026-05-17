"use client";

import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { parseNip29GroupIdentifier } from "@/app/features/groups/utils/parse-nip29-group-identifier";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { discoveryCache, type DiscoveryProfileRecord } from "./discovery-cache";
import { queryRelayProfiles, type RelayQueryPool } from "./relay-discovery-query";
import { queryRelayCommunities, type RelayCommunityRecord } from "./relay-community-discovery-query";
import { extractContactCardFromQuery, verifyContactCard } from "./contact-card";
import type {
  ContactCardV1,
  DiscoveryConfidence,
  DiscoveryIntent,
  DiscoveryPhase,
  DiscoveryQueryState,
  DiscoveryReasonCode,
  DiscoveryResult,
  DiscoverySource,
  DiscoverySourceStatus,
} from "@/app/features/search/types/discovery";

type DiscoveryQueryKind = "empty" | "invite_code" | "contact_card" | "pubkey" | "community_ref" | "text";

type CommunitySeed = Readonly<{
  communityId: string;
  relayUrl: string;
  name?: string;
  about?: string;
  picture?: string;
  updatedAtUnixMs?: number;
}>;

type DiscoveryQueryPlan = Readonly<{
  normalizedQuery: string;
  queryKind: DiscoveryQueryKind;
  effectiveIntent: DiscoveryIntent;
  pubkey?: string;
  communityRef?: Readonly<{ communityId: string; relayUrl: string }>;
  inviteCode?: string;
  contactCard?: ContactCardV1;
}>;

type IndexLookupResult = Readonly<{
  people?: ReadonlyArray<DiscoveryProfileRecord>;
  communities?: ReadonlyArray<CommunitySeed>;
}>;

type RunDiscoveryParams = Readonly<{
  query: string;
  intent: DiscoveryIntent;
  pool: RelayQueryPool;
  localCommunities?: ReadonlyArray<CommunitySeed>;
  indexBaseUrl?: string;
  relayTimeoutMs?: number;
  skipRelayLookup?: boolean;
  nowUnixMs?: number;
  signal?: AbortSignal;
  onProgress?: (state: DiscoveryQueryState, results: ReadonlyArray<DiscoveryResult>) => void;
}>;

type RunDiscoveryResult = Readonly<{
  state: DiscoveryQueryState;
  results: ReadonlyArray<DiscoveryResult>;
}>;

const INDEX_PARTIAL_TIMEOUT_MS = 1_000;
const RELAY_TIMEOUT_MS = 7_500;

const createSourceStatusMap = (): Record<DiscoverySource, DiscoverySourceStatus> => ({
  local: { state: "idle" },
  relay: { state: "idle" },
  index: { state: "idle" },
});

const nowMs = (): number => Date.now();

const asMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
};

const classifyQuery = (intent: DiscoveryIntent, rawQuery: string): DiscoveryQueryPlan => {
  const normalizedQuery = rawQuery.trim();
  if (!normalizedQuery) {
    return {
      normalizedQuery,
      queryKind: "empty",
      effectiveIntent: intent,
    };
  }

  const card = extractContactCardFromQuery(normalizedQuery);
  if (card) {
    return {
      normalizedQuery,
      queryKind: "contact_card",
      effectiveIntent: "resolve_card",
      contactCard: card,
      pubkey: card.pubkey,
      inviteCode: card.inviteCode,
    };
  }

  const normalizedUpper = normalizedQuery.toUpperCase();
  if (isValidInviteCode(normalizedUpper)) {
    return {
      normalizedQuery,
      queryKind: "invite_code",
      effectiveIntent: "resolve_invite",
      inviteCode: normalizedUpper,
    };
  }

  const parsedPublicKey = parsePublicKeyInput(normalizedQuery);
  if (parsedPublicKey.ok) {
    return {
      normalizedQuery,
      queryKind: "pubkey",
      effectiveIntent: "resolve_card",
      pubkey: parsedPublicKey.publicKeyHex,
    };
  }

  if (normalizedQuery.includes("'")) {
    const parsedGroup = parseNip29GroupIdentifier(normalizedQuery);
    if (parsedGroup.ok) {
      return {
        normalizedQuery,
        queryKind: "community_ref",
        effectiveIntent: "search_communities",
        communityRef: {
          communityId: parsedGroup.groupId,
          relayUrl: parsedGroup.relayUrl,
        },
      };
    }
  }

  if (intent === "add_friend") {
    return {
      normalizedQuery,
      queryKind: "text",
      effectiveIntent: "search_people",
    };
  }

  return {
    normalizedQuery,
    queryKind: "text",
    effectiveIntent: intent,
  };
};

const profileRecordToResult = (
  profile: DiscoveryProfileRecord,
  source: DiscoverySource,
  score: number
): DiscoveryResult => ({
  canonicalId: profile.pubkey,
  kind: "person",
  display: {
    title: profile.name || profile.displayName || profile.pubkey.slice(0, 12),
    subtitle: profile.displayName,
    description: profile.about,
    picture: profile.picture,
    pubkey: profile.pubkey,
    inviteCode: profile.inviteCode,
  },
  confidence: source === "relay" ? "relay_confirmed" : "cached_only",
  sources: [source],
  score,
  freshnessUnixMs: profile.updatedAtUnixMs,
});

const communityRecordToResult = (
  community: CommunitySeed,
  source: DiscoverySource,
  score: number
): DiscoveryResult => ({
  canonicalId: `${community.relayUrl}:${community.communityId}`,
  kind: "community",
  display: {
    title: community.name || community.communityId,
    subtitle: community.communityId,
    description: community.about,
    picture: community.picture,
    communityId: community.communityId,
    relayUrl: community.relayUrl,
  },
  confidence: source === "relay" ? "relay_confirmed" : "cached_only",
  sources: [source],
  score,
  freshnessUnixMs: community.updatedAtUnixMs ?? nowMs(),
});

const createDirectInviteResult = (params: Readonly<{
  inviteCode: string;
  pubkey: string;
  title?: string;
  picture?: string;
  description?: string;
}>): DiscoveryResult => ({
  canonicalId: params.pubkey,
  kind: "invite",
  display: {
    title: params.title || params.pubkey.slice(0, 12),
    picture: params.picture,
    description: params.description,
    pubkey: params.pubkey,
    inviteCode: params.inviteCode,
  },
  confidence: "direct",
  sources: ["local"],
  score: 100,
  freshnessUnixMs: nowMs(),
});

const createDirectCardResult = (params: Readonly<{
  card: ContactCardV1;
  isVerified: boolean;
}>): DiscoveryResult => ({
  canonicalId: params.card.pubkey,
  kind: "contact_card",
  display: {
    title: params.card.label || params.card.pubkey.slice(0, 12),
    pubkey: params.card.pubkey,
    inviteCode: params.card.inviteCode,
    description: params.isVerified ? "Verified contact card" : "Unverified contact card",
    contactCardRaw: JSON.stringify(params.card),
  },
  confidence: "direct",
  sources: ["local"],
  score: params.isVerified ? 110 : 95,
  freshnessUnixMs: params.card.issuedAt,
});

const createDirectPubkeyResult = (params: Readonly<{
  pubkey: string;
  title?: string;
  subtitle?: string;
  description?: string;
  picture?: string;
  inviteCode?: string;
}>): DiscoveryResult => ({
  canonicalId: params.pubkey,
  kind: "person",
  display: {
    title: params.title || params.pubkey.slice(0, 12),
    subtitle: params.subtitle,
    description: params.description,
    picture: params.picture,
    pubkey: params.pubkey,
    inviteCode: params.inviteCode,
  },
  confidence: "direct",
  sources: ["local"],
  score: 108,
  freshnessUnixMs: nowMs(),
});

const mergeResults = (results: ReadonlyArray<DiscoveryResult>): DiscoveryResult[] => {
  const merged = new Map<string, DiscoveryResult>();
  results.forEach((result) => {
    const existing = merged.get(result.canonicalId);
    if (!existing) {
      merged.set(result.canonicalId, result);
      return;
    }
    const sources = Array.from(new Set([...existing.sources, ...result.sources]));
    const confidence: DiscoveryConfidence = existing.confidence === "direct" || result.confidence === "direct"
      ? "direct"
      : (sources.includes("relay") ? "relay_confirmed" : "cached_only");
    merged.set(result.canonicalId, {
      ...existing,
      display: {
        ...existing.display,
        ...result.display,
      },
      score: Math.max(existing.score, result.score) + (sources.length > existing.sources.length ? 2 : 0),
      sources,
      confidence,
      freshnessUnixMs: Math.max(existing.freshnessUnixMs, result.freshnessUnixMs),
    });
  });
  return Array.from(merged.values()).sort((a, b) => b.score - a.score || b.freshnessUnixMs - a.freshnessUnixMs);
};

const fetchWithTimeout = async (url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response> => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
  const onAbort = (): void => abortController.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { signal: abortController.signal });
  } finally {
    clearTimeout(timeoutHandle);
    signal?.removeEventListener("abort", onAbort);
  }
};

const parseIndexRecords = (raw: unknown): IndexLookupResult => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const payload = raw as Record<string, unknown>;
  const peopleRaw = Array.isArray(payload.people) ? payload.people : (Array.isArray(payload.results) ? payload.results : []);
  const communitiesRaw = Array.isArray(payload.communities) ? payload.communities : [];

  const people = peopleRaw.map((item): DiscoveryProfileRecord | null => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.pubkey !== "string") return null;
    return {
      pubkey: row.pubkey,
      name: typeof row.name === "string" ? row.name : undefined,
      displayName: typeof row.display_name === "string"
        ? row.display_name
        : (typeof row.displayName === "string" ? row.displayName : undefined),
      about: typeof row.about === "string" ? row.about : undefined,
      picture: typeof row.picture === "string"
        ? row.picture
        : (typeof row.avatar === "string" ? row.avatar : undefined),
      nip05: typeof row.nip05 === "string" ? row.nip05 : undefined,
      inviteCode: typeof row.inviteCode === "string" ? row.inviteCode : undefined,
      updatedAtUnixMs: typeof row.updatedAtUnixMs === "number" ? row.updatedAtUnixMs : nowMs(),
    };
  }).filter((entry): entry is DiscoveryProfileRecord => entry !== null);

  const communities = communitiesRaw.map((item): CommunitySeed | null => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.communityId !== "string" || typeof row.relayUrl !== "string") {
      return null;
    }
    return {
      communityId: row.communityId,
      relayUrl: row.relayUrl,
      name: typeof row.name === "string" ? row.name : undefined,
      about: typeof row.about === "string" ? row.about : undefined,
      picture: typeof row.picture === "string" ? row.picture : undefined,
      updatedAtUnixMs: typeof row.updatedAtUnixMs === "number" ? row.updatedAtUnixMs : nowMs(),
    };
  }).filter((entry): entry is CommunitySeed => entry !== null);

  return { people, communities };
};

const runIndexSource = async (params: Readonly<{
  query: string;
  intent: DiscoveryIntent;
  indexBaseUrl?: string;
  signal?: AbortSignal;
}>): Promise<IndexLookupResult> => {
  const baseUrl = params.indexBaseUrl?.trim();
  if (!baseUrl) {
    throw new Error("index_unavailable");
  }
  const route = params.intent === "search_communities" ? "communities" : "people";
  const endpoint = new URL(`/v1/discovery/${route}`, baseUrl);
  endpoint.searchParams.set("q", params.query);
  const response = await fetchWithTimeout(endpoint.toString(), INDEX_PARTIAL_TIMEOUT_MS, params.signal);
  if (!response.ok) {
    throw new Error(`Index lookup failed (${response.status})`);
  }
  const payload = await response.json();
  return parseIndexRecords(payload);
};

const runRelayPeopleLookup = async (params: Readonly<{
  plan: DiscoveryQueryPlan;
  pool: RelayQueryPool;
  timeoutMs: number;
}>): Promise<ReadonlyArray<DiscoveryProfileRecord>> => {
  if (params.plan.effectiveIntent === "search_communities") {
    return [];
  }
  if (params.plan.queryKind === "community_ref") {
    return [];
  }
  const mode = params.plan.queryKind === "invite_code"
    ? "invite"
    : params.plan.queryKind === "pubkey"
      ? "author"
      : "text";
  const relayQuery = params.plan.queryKind === "invite_code"
    ? (params.plan.inviteCode ?? params.plan.normalizedQuery)
    : (params.plan.pubkey ?? params.plan.normalizedQuery);
  return queryRelayProfiles({
    pool: params.pool,
    mode,
    query: relayQuery,
    timeoutMs: params.timeoutMs,
    maxResults: params.plan.queryKind === "invite_code" ? 24 : 150,
  });
};

const runRelayCommunityLookup = async (params: Readonly<{
  plan: DiscoveryQueryPlan;
  pool: RelayQueryPool;
  timeoutMs: number;
}>): Promise<ReadonlyArray<RelayCommunityRecord>> => {
  if (params.plan.effectiveIntent !== "search_communities") {
    return [];
  }
  const query = params.plan.communityRef
    ? `${params.plan.communityRef.communityId} ${params.plan.communityRef.relayUrl}`
    : params.plan.normalizedQuery;
  return queryRelayCommunities({
    pool: params.pool,
    query,
    timeoutMs: params.timeoutMs,
    maxResults: 120,
  });
};

const toQueryState = (params: Readonly<{
  intent: DiscoveryIntent;
  query: string;
  phase: DiscoveryPhase;
  sourceStatusMap: Record<DiscoverySource, DiscoverySourceStatus>;
  startedAt: number;
  reasonCode?: DiscoveryReasonCode;
}>): DiscoveryQueryState => ({
  intent: params.intent,
  query: params.query,
  phase: params.phase,
  reasonCode: params.reasonCode,
  elapsedMs: Math.max(0, nowMs() - params.startedAt),
  sourceStatusMap: params.sourceStatusMap,
});

export const QueryPlanner = {
  classifyQuery,
};

export const ResultMerger = {
  mergeResults,
};

export const DiscoveryEngine = {
  async run(params: RunDiscoveryParams): Promise<RunDiscoveryResult> {
    const startedAt = params.nowUnixMs ?? nowMs();
    const sourceStatusMap = createSourceStatusMap();
    const plan = classifyQuery(params.intent, params.query);
    const relayTimeoutMs = params.relayTimeoutMs ?? RELAY_TIMEOUT_MS;
    let combinedResults: DiscoveryResult[] = [];

    const emit = (phase: DiscoveryPhase, reasonCode?: DiscoveryReasonCode): DiscoveryQueryState => {
      const state = toQueryState({
        intent: params.intent,
        query: params.query,
        phase,
        reasonCode,
        sourceStatusMap,
        startedAt,
      });
      params.onProgress?.(state, combinedResults);
      return state;
    };

    if (plan.queryKind === "empty") {
      return {
        results: [],
        state: emit("idle"),
      };
    }

    emit("running");
    if (params.signal?.aborted) {
      return { results: [], state: emit("degraded", "canceled") };
    }

    if (plan.queryKind === "contact_card" && plan.contactCard) {
      sourceStatusMap.local = { state: "running" };
      const isValid = await withAbort(verifyContactCard(plan.contactCard), params.signal).catch(() => false);
      sourceStatusMap.local = {
        state: "success",
        elapsedMs: nowMs() - startedAt,
      };
      combinedResults = [createDirectCardResult({ card: plan.contactCard, isVerified: isValid })];
      emit("partial");
    }

    sourceStatusMap.local = { state: "running" };
    const localResults: DiscoveryResult[] = [];
    const localProfiles = plan.effectiveIntent === "search_communities"
      ? []
      : discoveryCache.searchProfiles(plan.pubkey ?? plan.inviteCode ?? plan.normalizedQuery, 60);
    localProfiles.forEach((record) => {
      localResults.push(profileRecordToResult(record, "local", 62));
    });

    if (plan.effectiveIntent === "search_communities") {
      (params.localCommunities ?? [])
        .filter((community) => {
          if (plan.communityRef) {
            return community.communityId === plan.communityRef.communityId
              && community.relayUrl === plan.communityRef.relayUrl;
          }
          const q = plan.normalizedQuery.toLowerCase();
          return community.communityId.toLowerCase().includes(q)
            || (community.name ?? "").toLowerCase().includes(q)
            || (community.about ?? "").toLowerCase().includes(q);
        })
        .forEach((community) => {
          localResults.push(communityRecordToResult(community, "local", 57));
        });
    }

    if (plan.queryKind === "invite_code" && plan.inviteCode) {
      const resolved = discoveryCache.resolveInviteCode(plan.inviteCode);
      if (resolved) {
        localResults.push(createDirectInviteResult({
          inviteCode: plan.inviteCode,
          pubkey: resolved.pubkey,
          title: resolved.displayName || resolved.name,
          picture: resolved.picture,
          description: resolved.about,
        }));
      }
    }

    if (plan.queryKind === "pubkey" && plan.pubkey) {
      const cachedProfile = localProfiles.find((record) => record.pubkey === plan.pubkey);
      localResults.push(createDirectPubkeyResult({
        pubkey: plan.pubkey,
        title: cachedProfile?.displayName || cachedProfile?.name,
        subtitle: cachedProfile?.nip05,
        description: cachedProfile?.about,
        picture: cachedProfile?.picture,
        inviteCode: cachedProfile?.inviteCode,
      }));
    }

    sourceStatusMap.local = {
      state: "success",
      elapsedMs: nowMs() - startedAt,
    };
    combinedResults = mergeResults([...combinedResults, ...localResults]);
    if (combinedResults.length > 0) {
      emit("partial");
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return {
        results: combinedResults,
        state: emit("offline", "offline"),
      };
    }

    sourceStatusMap.index = { state: "running" };
    try {
      const indexResults = await withAbort(runIndexSource({
        query: plan.normalizedQuery,
        intent: plan.effectiveIntent,
        indexBaseUrl: params.indexBaseUrl,
        signal: params.signal,
      }), params.signal);
      const mapped: DiscoveryResult[] = [];
      (indexResults.people ?? []).forEach((profile) => {
        mapped.push(profileRecordToResult(profile, "index", 66));
      });
      (indexResults.communities ?? []).forEach((community) => {
        mapped.push(communityRecordToResult(community, "index", 63));
      });
      sourceStatusMap.index = {
        state: "success",
        elapsedMs: nowMs() - startedAt,
      };
      if (mapped.length > 0) {
        combinedResults = mergeResults([...combinedResults, ...mapped]);
        emit("partial");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          results: combinedResults,
          state: emit("degraded", "canceled"),
        };
      }
      if (asMessage(error) === "index_unavailable") {
        sourceStatusMap.index = {
          state: "skipped",
          elapsedMs: nowMs() - startedAt,
        };
      } else {
      sourceStatusMap.index = {
        state: "error",
        message: asMessage(error),
        elapsedMs: nowMs() - startedAt,
      };
      }
    }

    if (params.skipRelayLookup) {
      sourceStatusMap.relay = {
        state: "skipped",
        message: "No writable relays available",
        elapsedMs: nowMs() - startedAt,
      };
      if (combinedResults.length === 0) {
        return {
          results: combinedResults,
          state: emit("degraded", "relay_degraded"),
        };
      }
      return {
        results: combinedResults,
        state: emit("degraded", "relay_degraded"),
      };
    }

    sourceStatusMap.relay = { state: "running" };
    try {
      const [relayProfiles, relayCommunities] = await Promise.all([
        withAbort(runRelayPeopleLookup({
          plan,
          pool: params.pool,
          timeoutMs: relayTimeoutMs,
        }), params.signal),
        withAbort(runRelayCommunityLookup({
          plan,
          pool: params.pool,
          timeoutMs: relayTimeoutMs,
        }), params.signal),
      ]);

      relayProfiles.forEach((profile) => {
        discoveryCache.upsertProfile(profile);
      });

      const relayMapped: DiscoveryResult[] = [
        ...relayProfiles.map((profile) => profileRecordToResult(profile, "relay", 82)),
        ...relayCommunities.map((community) => communityRecordToResult(community, "relay", 79)),
      ];

      sourceStatusMap.relay = {
        state: "success",
        message: relayMapped.length > 0 ? undefined : "no_matches",
        elapsedMs: nowMs() - startedAt,
      };

      if (relayMapped.length > 0) {
        combinedResults = mergeResults([...combinedResults, ...relayMapped]);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          results: combinedResults,
          state: emit("degraded", "canceled"),
        };
      }
      sourceStatusMap.relay = {
        state: "error",
        message: asMessage(error),
        elapsedMs: nowMs() - startedAt,
      };
    }

    const relayFailed = sourceStatusMap.relay.state === "error" || sourceStatusMap.relay.state === "timeout";
    const noMatches = combinedResults.length === 0;
    if (noMatches && relayFailed) {
      return {
        results: combinedResults,
        state: emit("degraded", "relay_degraded"),
      };
    }
    if (noMatches) {
      return {
        results: combinedResults,
        state: emit("complete", "no_match"),
      };
    }
    if (relayFailed) {
      return {
        results: combinedResults,
        state: emit("degraded", "relay_degraded"),
      };
    }
    return {
      results: combinedResults,
      state: emit("complete"),
    };
  },
};

export const discoveryEngineInternals = {
  classifyQuery,
  mergeResults,
  parseIndexRecords,
};
