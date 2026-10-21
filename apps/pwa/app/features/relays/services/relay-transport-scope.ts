import {
  isPublicDefaultRelayHost,
  normalizeRelayHost,
} from "@/app/features/groups/services/community-mode-contract";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

export type RelayTransportScope = "dm" | "community_candidate";

/** Matches `infra/docker-compose.nostr.yml` (host port 7000 → container 8080). */
export const LOCAL_DEV_WORKSPACE_RELAY_URL = "ws://localhost:7000";

export const isLocalDevWorkspaceRelayUrl = (relayUrl: string): boolean => (
  workspaceRelayUrlsMatch(relayUrl, LOCAL_DEV_WORKSPACE_RELAY_URL)
);

/**
 * Loopback mesh HTTP gateway (C8+/C10) — `http(s)://127.0.0.1|localhost`.
 * Classified as community_candidate for workspace UI, but must join the DM pool
 * when enabled so HTTP-only Conduit Mesh soaks can publish/pull.
 */
export const isLocalMeshHttpGatewayUrl = (relayUrl: string): boolean => {
  const trimmed = relayUrl.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.trim().toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
};

const PRIVATE_IPV4_RANGES: ReadonlyArray<Readonly<{ prefix: string; nextOctetRange?: Readonly<[number, number]> }>> = [
  { prefix: "10." },
  { prefix: "127." },
  { prefix: "192.168." },
  { prefix: "169.254." },
  { prefix: "172.", nextOctetRange: [16, 31] },
];

const isPrivateIpv4Host = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  return PRIVATE_IPV4_RANGES.some((range) => {
    if (!normalized.startsWith(range.prefix)) {
      return false;
    }
    if (!range.nextOctetRange) {
      return true;
    }
    const octets = normalized.split(".");
    const nextOctet = Number(octets[1]);
    if (!Number.isFinite(nextOctet)) {
      return false;
    }
    return nextOctet >= range.nextOctetRange[0] && nextOctet <= range.nextOctetRange[1];
  });
};

/** Localhost, RFC1918, and common intranet DNS suffixes. */
export const isPrivateOrIntranetRelayUrl = (relayUrl: string): boolean => {
  const host = normalizeRelayHost(relayUrl);
  if (!host) {
    return false;
  }

  if (
    host === "localhost"
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host.endsWith(".lan")
    || host.endsWith(".home")
  ) {
    return true;
  }

  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }

  return isPrivateIpv4Host(host);
};

export const classifyRelayTransportScope = (relayUrl: string): RelayTransportScope => (
  isCommunityRelayCandidateUrl(relayUrl) ? "community_candidate" : "dm"
);

/** Relays used for DM, profile publish, and the global Nostr transport pool. */
export const isDmTransportRelayUrl = (relayUrl: string): boolean => (
  !isCommunityRelayCandidateUrl(relayUrl)
);

/**
 * Relays that may be chosen when creating a managed workspace community.
 * Excludes well-known public Nostr defaults; includes private/intranet and custom team relays.
 */
export const isCommunityRelayCandidateUrl = (relayUrl: string): boolean => {
  if (isPrivateOrIntranetRelayUrl(relayUrl)) {
    return true;
  }
  const host = normalizeRelayHost(relayUrl);
  if (!host) {
    return false;
  }
  return !isPublicDefaultRelayHost(host);
};

export type RelayListEntry = Readonly<{
  url: string;
  enabled: boolean;
}>;

export const resolveDmTransportRelayUrls = (
  relays: ReadonlyArray<RelayListEntry>,
): ReadonlyArray<string> => {
  const dmUrls = relays
    .filter((relay) => relay.enabled && isDmTransportRelayUrl(relay.url))
    .map((relay) => relay.url);

  // Consumer path: public/VPS remotes alone — do not append dead Docker/8788 lab assists.
  if (dmUrls.length > 0) {
    return dmUrls;
  }

  const meshHttpUrls = relays
    .filter((relay) => relay.enabled && isLocalMeshHttpGatewayUrl(relay.url))
    .map((relay) => relay.url);

  let pool: ReadonlyArray<string> = dmUrls;

  // Soft L3 / lab-only: local-dev WS + loopback HTTP when no remotes are enabled.
  const localDevRelay = relays.find(
    (relay) => relay.enabled && isLocalDevWorkspaceRelayUrl(relay.url),
  );
  if (localDevRelay) {
    const withoutLocalDup = pool.filter(
      (url) => !workspaceRelayUrlsMatch(url, localDevRelay.url),
    );
    pool = withoutLocalDup.length === 0
      ? [localDevRelay.url]
      : [...withoutLocalDup, localDevRelay.url];
  }

  if (meshHttpUrls.length === 0) {
    return pool;
  }

  const withoutMeshDup = pool.filter(
    (url) => !meshHttpUrls.some((meshUrl) => workspaceRelayUrlsMatch(url, meshUrl)),
  );
  if (withoutMeshDup.length === 0) {
    return meshHttpUrls;
  }
  return [...withoutMeshDup, ...meshHttpUrls];
};

export const resolveCommunityCandidateRelayUrls = (
  relays: ReadonlyArray<RelayListEntry>,
): ReadonlyArray<string> => (
  relays
    .filter((relay) => relay.enabled && isCommunityRelayCandidateUrl(relay.url))
    .map((relay) => relay.url)
);

export const partitionRelayListByTransportScope = (
  relays: ReadonlyArray<RelayListEntry>,
): Readonly<{ dm: ReadonlyArray<RelayListEntry>; community: ReadonlyArray<RelayListEntry> }> => {
  const dm: RelayListEntry[] = [];
  const community: RelayListEntry[] = [];
  relays.forEach((relay) => {
    if (isCommunityRelayCandidateUrl(relay.url)) {
      community.push(relay);
    } else {
      dm.push(relay);
    }
  });
  return { dm, community };
};

/**
 * Advanced DM adapters list: partition.dm plus local-dev / loopback mesh URLs that
 * resolveDmTransportRelayUrls joins into the DM pool (still listed under Workspace too).
 */
export const resolveDmAdapterListEntries = (
  relays: ReadonlyArray<RelayListEntry>,
): ReadonlyArray<RelayListEntry> => {
  const partition = partitionRelayListByTransportScope(relays);
  const dmPoolUrls = resolveDmTransportRelayUrls(relays);
  if (dmPoolUrls.length === 0) {
    return partition.dm;
  }
  const seen = new Set(partition.dm.map((relay) => relay.url));
  const assistEntries = relays.filter((relay) => {
    const inPool = dmPoolUrls.some((poolUrl) => (
      poolUrl === relay.url || workspaceRelayUrlsMatch(poolUrl, relay.url)
    ));
    if (!inPool || seen.has(relay.url)) {
      return false;
    }
    seen.add(relay.url);
    return true;
  });
  return [...partition.dm, ...assistEntries];
};

/**
 * On storage migration, disable private/intranet relays so unreachable local nodes
 * do not join the DM transport pool until the user explicitly enables them.
 */
export const applyRelayListScopeMigration = (
  relays: ReadonlyArray<RelayListEntry>,
): ReadonlyArray<RelayListEntry> => (
  relays.map((relay) => (
    isPrivateOrIntranetRelayUrl(relay.url)
      ? { url: relay.url, enabled: false }
      : relay
  ))
);

const isLoopbackRelayHost = (relayUrl: string): boolean => {
  const host = normalizeRelayHost(relayUrl);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
};

/**
 * True when every configured URL is loopback (lab/Docker leftover).
 * Does not match intentional LAN/team private lists (RFC1918 non-loopback).
 */
export const isLoopbackOnlyRelayList = (
  relays: ReadonlyArray<RelayListEntry>,
): boolean => (
  relays.length > 0 && relays.every((relay) => isLoopbackRelayHost(relay.url))
);

/**
 * Prod-first: if storage still has only localhost relays, merge Default Stable
 * public rows (enabled) and keep loopback rows so metrics show the public pool.
 */
export const mergePublicBootIntoLoopbackOnlyList = (
  relays: ReadonlyArray<RelayListEntry>,
  publicBootRows: ReadonlyArray<RelayListEntry>,
): Readonly<{ relays: ReadonlyArray<RelayListEntry>; changed: boolean }> => {
  if (!isLoopbackOnlyRelayList(relays) || publicBootRows.length === 0) {
    return { relays, changed: false };
  }
  const merged: RelayListEntry[] = publicBootRows.map((row) => ({
    url: row.url,
    enabled: row.enabled !== false,
  }));
  for (const relay of relays) {
    const exists = merged.some((entry) => (
      entry.url === relay.url || workspaceRelayUrlsMatch(entry.url, relay.url)
    ));
    if (!exists) {
      merged.push({ url: relay.url, enabled: relay.enabled });
    }
  }
  return { relays: merged, changed: true };
};

/**
 * Stuck profile heal: every relay `enabled:false` → open sockets stay 0 forever.
 * Re-enable non-loopback rows already present; if only loopback remains, merge public boot.
 * Does not run when any relay is already enabled (respects intentional bulk-disable… until next load
 * after a full disable — see Settings Enable All CTA for explicit opt-in).
 *
 * Note: bulk-disable that leaves zero enabled will be healed on next cold load. That is intentional
 * for Settings restore / DM path; users who want offline-only can leave Advanced → Disable All and
 * re-disable after unlock if needed.
 */
export const reenableWhenNoRelaysEnabled = (
  relays: ReadonlyArray<RelayListEntry>,
  publicBootRows: ReadonlyArray<RelayListEntry>,
): Readonly<{ relays: ReadonlyArray<RelayListEntry>; changed: boolean }> => {
  if (relays.length === 0) {
    if (publicBootRows.length === 0) {
      return { relays, changed: false };
    }
    return {
      relays: publicBootRows.map((row) => ({ url: row.url, enabled: row.enabled !== false })),
      changed: true,
    };
  }
  if (relays.some((relay) => relay.enabled)) {
    return { relays, changed: false };
  }
  const withPublicOn = relays.map((relay) => (
    isLoopbackRelayHost(relay.url) ? relay : { url: relay.url, enabled: true }
  ));
  if (withPublicOn.some((relay) => relay.enabled)) {
    return { relays: withPublicOn, changed: true };
  }
  return mergePublicBootIntoLoopbackOnlyList(relays, publicBootRows);
};
