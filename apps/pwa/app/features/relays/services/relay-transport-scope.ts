import {
  isPublicDefaultRelayHost,
  normalizeRelayHost,
} from "@/app/features/groups/services/community-mode-contract";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";

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

  const meshHttpUrls = relays
    .filter((relay) => relay.enabled && isLocalMeshHttpGatewayUrl(relay.url))
    .map((relay) => relay.url);

  let pool: ReadonlyArray<string> = dmUrls;

  if (isExperimentOnlineEnabled()) {
    const localDevRelay = relays.find(
      (relay) => relay.enabled && isLocalDevWorkspaceRelayUrl(relay.url),
    );
    if (localDevRelay) {
      const withoutLocalDup = pool.filter(
        (url) => !workspaceRelayUrlsMatch(url, localDevRelay.url),
      );
      // Keep public DM relays primary when Docker relay is down; local dev stays in pool as fallback.
      pool = withoutLocalDup.length === 0
        ? [localDevRelay.url]
        : [...withoutLocalDup, localDevRelay.url];
    }
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
