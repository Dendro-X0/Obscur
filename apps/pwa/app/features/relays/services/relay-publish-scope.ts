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

  return withoutOfflineLocalDev.length > 0 ? withoutOfflineLocalDev : trimmed;
};

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
