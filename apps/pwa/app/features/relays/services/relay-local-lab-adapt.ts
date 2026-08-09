import {
  isLocalDevWorkspaceRelayUrl,
  isLocalMeshHttpGatewayUrl,
} from "./relay-transport-scope";

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
 * Docker WS (:7000) and loopback HTTP mesh (:8788) — lab assists, not consumer transport.
 */
export const isLocalLabAssistRelayUrl = (relayUrl: string): boolean => (
  isLocalDevWorkspaceRelayUrl(relayUrl) || isLocalMeshHttpGatewayUrl(relayUrl)
);

/**
 * Nostr-first lab silo: when any public/VPS remote is enabled, exclude local lab
 * assists from the active dial pool. Soft L3 = lab alone (remotes disabled).
 */
export const shouldDemoteLocalLabFromActivePool = (params: Readonly<{
  localUrl: string;
  hint?: LocalLabHealthHint | undefined;
  remotesEnabled: boolean;
}>): boolean => {
  if (!params.remotesEnabled) {
    return false;
  }
  return isLocalLabAssistRelayUrl(params.localUrl);
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
