import {
  isPublicDefaultRelayHost,
  normalizeRelayHost,
} from "@/app/features/groups/services/community-mode-contract";

export type RelayTransportScope = "dm" | "community_candidate";

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
): ReadonlyArray<string> => (
  relays
    .filter((relay) => relay.enabled && isDmTransportRelayUrl(relay.url))
    .map((relay) => relay.url)
);

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
