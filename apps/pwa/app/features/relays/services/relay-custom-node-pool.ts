import { readOperatorWorkspaceRelayUrl } from "@/app/features/groups/services/operator-trust-config";
import { normalizeWorkspaceRelayUrl } from "@/app/features/groups/services/workspace-relay-url";

const normalizeRelayUrlForMatch = (relayUrl: string): string => (
  normalizeWorkspaceRelayUrl(relayUrl)
);

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  relayUrls.forEach((relayUrl) => {
    const normalized = normalizeRelayUrlForMatch(relayUrl).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ordered.push(normalizeRelayUrlForMatch(relayUrl));
  });
  return ordered;
};

/**
 * Enabled workspace / operator-configured relays that must stay reachable
 * independently of Nostr DM transport mode (basic vs redundancy).
 */
export const resolveEnabledCustomNodeRelayUrls = (params: Readonly<{
  communityCandidateRelayUrls: ReadonlyArray<string>;
  operatorWorkspaceRelayUrl?: string | null;
}>): ReadonlyArray<string> => {
  const operatorRelay = (params.operatorWorkspaceRelayUrl ?? readOperatorWorkspaceRelayUrl())?.trim();
  return dedupeRelayUrls([
    ...params.communityCandidateRelayUrls,
    ...(operatorRelay ? [operatorRelay] : []),
  ]);
};

/** Socket pool URLs: Nostr active pool first, then custom nodes (deduped). */
export const mergeNostrPoolWithCustomNodeRelayUrls = (params: Readonly<{
  nostrActivePoolRelayUrls: ReadonlyArray<string>;
  customNodeRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => (
  dedupeRelayUrls([
    ...params.nostrActivePoolRelayUrls,
    ...params.customNodeRelayUrls,
  ])
);

export const relayCustomNodePoolInternals = {
  normalizeRelayUrlForMatch,
  dedupeRelayUrls,
};
