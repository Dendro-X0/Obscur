import { isLocalDevWorkspaceRelayUrl } from "./relay-transport-scope";

/** Subset of dial health (call-site stability; unused by the product demote gate). */
export type LocalLabHealthHint = Readonly<{
  url: string;
  isOpen: boolean;
  isWritable?: boolean;
  isCircuitOpen?: boolean;
  latencyMs?: number;
}>;

/** Settings “High latency” badge threshold — not used for lab demotion. */
export const LOCAL_LAB_HIGH_LATENCY_MS = 1_500;

/**
 * Nostr-first lab silo: when any public/VPS remote is enabled, always exclude
 * `ws://localhost:7000` from the active dial pool. Soft L3 = Local Dev Mesh alone
 * (remotes disabled). Open socket / RTT do not keep lab ACTIVE beside remotes.
 */
export const shouldDemoteLocalLabFromActivePool = (params: Readonly<{
  localUrl: string;
  hint?: LocalLabHealthHint | undefined;
  remotesEnabled: boolean;
}>): boolean => {
  if (!params.remotesEnabled) {
    return false;
  }
  return isLocalDevWorkspaceRelayUrl(params.localUrl);
};

export const filterDemotedLocalLabUrls = (params: Readonly<{
  orderedEnabledUrls: ReadonlyArray<string>;
  hints?: ReadonlyArray<LocalLabHealthHint>;
  remotesEnabled: boolean;
}>): ReadonlyArray<string> => {
  if (!params.remotesEnabled) {
    return params.orderedEnabledUrls;
  }
  return params.orderedEnabledUrls.filter((url) => (
    !shouldDemoteLocalLabFromActivePool({
      localUrl: url,
      remotesEnabled: true,
    })
  ));
};
