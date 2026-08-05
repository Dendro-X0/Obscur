import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { isLocalDevWorkspaceRelayUrl } from "./relay-transport-scope";

const relayUrlIsOpen = (
  relayUrl: string,
  pool: RelayPoolLike,
): boolean => (
  pool.connections.some((connection) => (
    connection.status === "open"
    && workspaceRelayUrlsMatch(connection.url, relayUrl)
  ))
);

/**
 * Scoped publish should not treat an offline local Docker dev relay as a required
 * peer when public relays are available. Production users never run localhost:7000.
 *
 * S1: when any non-local candidate is open, never sole-target localhost — prefer
 * remotes (local is lab assist only). If no remotes are open, keep open local.
 */
export const resolveScopedPublishRelayUrls = (params: Readonly<{
  relayUrls: ReadonlyArray<string>;
  pool: RelayPoolLike;
}>): ReadonlyArray<string> => {
  const trimmed = params.relayUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  const withoutOfflineLocalDev = trimmed.filter((url) => {
    if (!isLocalDevWorkspaceRelayUrl(url)) {
      return true;
    }
    return relayUrlIsOpen(url, params.pool);
  });

  const candidates = withoutOfflineLocalDev.length > 0 ? withoutOfflineLocalDev : trimmed;

  const hasOpenRemote = candidates.some((url) => (
    !isLocalDevWorkspaceRelayUrl(url)
    && relayUrlIsOpen(url, params.pool)
  ));
  if (!hasOpenRemote) {
    return candidates;
  }

  const remotesOnly = candidates.filter((url) => !isLocalDevWorkspaceRelayUrl(url));
  return remotesOnly.length > 0 ? remotesOnly : candidates;
};

/**
 * S3: open sockets among the DM publish scope — what Relays UI should label as
 * the live publish path (not the primary chip alone).
 */
export const resolveOpenDmPublishPathRelayUrls = (params: Readonly<{
  relayUrls: ReadonlyArray<string>;
  pool: RelayPoolLike;
}>): ReadonlyArray<string> => (
  resolveScopedPublishRelayUrls(params).filter((url) => relayUrlIsOpen(url, params.pool))
);

export const shouldWarnRelayPartialCoverage = (params: Readonly<{
  successCount?: number;
  totalRelays?: number;
  metQuorum?: boolean;
}>): boolean => {
  if (params.metQuorum === true) {
    return false;
  }
  if (typeof params.successCount !== "number" || typeof params.totalRelays !== "number") {
    return false;
  }
  return params.successCount > 0 && params.successCount < params.totalRelays;
};

export const relayPublishScopeInternals = {
  relayUrlIsOpen,
};
