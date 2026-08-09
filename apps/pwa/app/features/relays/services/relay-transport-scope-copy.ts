import type { RelayPrimarySelection } from "./relay-primary-selector";
import type { RelayTransportMode } from "./relay-transport-mode";
import {
  partitionRelayListByTransportScope,
  resolveDmTransportRelayUrls,
  type RelayListEntry,
} from "./relay-transport-scope";
import { resolveTorViableDmRelayUrls } from "./relay-tor-viable";

export const formatRelayHostname = (url: string | null | undefined): string => {
  if (!url) {
    return "none";
  }
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^wss?:\/\//, "").split("/")[0] ?? url;
  }
};

/** S3: short label for open DM publish targets (hosts). */
export const getDmPublishPathCopy = (params: Readonly<{
  publishPathRelayUrls: ReadonlyArray<string>;
}>): string => {
  if (params.publishPathRelayUrls.length === 0) {
    return "DM publish path: none open";
  }
  const hosts = params.publishPathRelayUrls
    .map((url) => formatRelayHostname(url))
    .join(", ");
  return `DM publish path: ${hosts}`;
};

/**
 * Active-pool honesty: DM pool size uses resolveDmTransportRelayUrls (includes Local Dev Mesh
 * assist), not raw partition.dm enabled count (localhost is workspace-candidate only).
 * TI-3 / TI-1: count Tor-viable dial targets only when dials are actually tor_armed — not on
 * preference alone (Warming/Degraded keep clearnet pool counts).
 */
export const resolveActivePoolScopeSummaryCounts = (
  relays: ReadonlyArray<RelayListEntry>,
  options?: Readonly<{
    /** @deprecated Prefer torArmed — preference alone must not subtract CF from counts. */
    torPreferenceOn?: boolean;
    /** True only when Tor dial phase is tor_armed (Ready + gateway reachable). */
    torArmed?: boolean;
  }>,
): Readonly<{
  dmPoolEnabledCount: number;
  communityEnabledCount: number;
  communityConfiguredCount: number;
}> => {
  const partitioned = partitionRelayListByTransportScope(relays);
  const countTorViable = options?.torArmed ?? options?.torPreferenceOn ?? false;
  const dmPoolEnabledCount = countTorViable
    ? resolveTorViableDmRelayUrls(relays).length
    : resolveDmTransportRelayUrls(relays).length;
  return {
    dmPoolEnabledCount,
    communityEnabledCount: partitioned.community.filter((relay) => relay.enabled).length,
    communityConfiguredCount: partitioned.community.length,
  };
};

/** Charter honesty when Tor ON and Tor-viable dial pool is empty (no CF fallback). */
export const getTorEmptyPoolHonestyCopy = (): string => (
  "Tor is on — public Cloudflare relays are unreliable over Tor. Add an onion / Tor-viable relay, or turn Tor off for clearnet."
);

export const getActivePoolScopeSummaryCopy = (params: Readonly<{
  dmPoolEnabledCount: number;
  communityEnabledCount: number;
  communityConfiguredCount: number;
}>): string => (
  `DM transport pool: ${params.dmPoolEnabledCount} · Workspace candidates: ${params.communityEnabledCount} enabled (${params.communityConfiguredCount} configured). Unreachable intranet relays stay out of the DM pool until you enable them here.`
);

export const getActiveTransportScopeCopy = (params: Readonly<{
  selection: RelayPrimarySelection;
  transportMode: RelayTransportMode;
  activePoolRelayUrls: ReadonlyArray<string>;
  writableRelayCount: number;
  subscribableRelayCount: number;
  enabledRelayCount: number;
  /** S3: open remotes (or lab-only) used for DM publish — not primary alone. */
  publishPathRelayUrls?: ReadonlyArray<string>;
}>): string => {
  const host = formatRelayHostname(params.selection.primaryUrl);
  const publishPathSuffix = typeof params.publishPathRelayUrls === "undefined"
    ? ""
    : ` · ${getDmPublishPathCopy({ publishPathRelayUrls: params.publishPathRelayUrls })}`;
  if (params.transportMode === "redundancy") {
    const poolHosts = params.activePoolRelayUrls
      .map((url) => formatRelayHostname(url))
      .join(", ");
    return `Nostr redundancy pool (${params.activePoolRelayUrls.length}): ${poolHosts} · primary ${host} · publish-ready ${params.writableRelayCount} · subscribable ${params.subscribableRelayCount}${publishPathSuffix}`;
  }
  return `Nostr active transport: ${host} · publish-ready ${params.writableRelayCount} · subscribable ${params.subscribableRelayCount} · ${params.enabledRelayCount} enabled in list${publishPathSuffix}`;
};
