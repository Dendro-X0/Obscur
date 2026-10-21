import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
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
 * Self T1 / Track L: operator workspace bind may retain a local WS lab in the dial
 * pool while public remotes stay enabled. Mesh HTTP (:8788) is never retainable.
 */
export const isOperatorRetainedLocalLabUrl = (
  localUrl: string,
  retainLabUrl?: string | null,
): boolean => {
  if (!retainLabUrl || !isLocalDevWorkspaceRelayUrl(retainLabUrl)) {
    return false;
  }
  if (!isLocalDevWorkspaceRelayUrl(localUrl)) {
    return false;
  }
  return workspaceRelayUrlsMatch(localUrl, retainLabUrl);
};

/**
 * Nostr-first primary: never keep lab as DM primary when remotes are enabled —
 * even when the lab is retained for dial (Self T1 cell path).
 */
export const shouldAvoidLocalLabAsPrimary = (params: Readonly<{
  localUrl: string;
  remotesEnabled: boolean;
}>): boolean => (
  params.remotesEnabled && isLocalDevWorkspaceRelayUrl(params.localUrl)
);

/**
 * Nostr-first lab silo: when any public/VPS remote is enabled, exclude local lab
 * assists from the active dial pool — unless operator-retained (Self T1).
 * Soft L3 = lab alone (remotes disabled).
 */
export const shouldDemoteLocalLabFromActivePool = (params: Readonly<{
  localUrl: string;
  hint?: LocalLabHealthHint | undefined;
  remotesEnabled: boolean;
  /** Operator workspace URL — retain matching local WS lab in dial pool. */
  retainLabUrl?: string | null;
}>): boolean => {
  if (!params.remotesEnabled) {
    return false;
  }
  if (!isLocalLabAssistRelayUrl(params.localUrl)) {
    return false;
  }
  if (isOperatorRetainedLocalLabUrl(params.localUrl, params.retainLabUrl)) {
    return false;
  }
  return true;
};

/**
 * Drop demoted lab assists from the ordered dial set. Retained lab URLs pass through.
 */
export const filterDemotedLocalLabUrls = (params: Readonly<{
  orderedEnabledUrls: ReadonlyArray<string>;
  hints?: ReadonlyArray<LocalLabHealthHint>;
  remotesEnabled: boolean;
  retainLabUrl?: string | null;
}>): ReadonlyArray<string> => {
  if (!params.remotesEnabled) {
    return params.orderedEnabledUrls;
  }
  return params.orderedEnabledUrls.filter((url) => (
    !shouldDemoteLocalLabFromActivePool({
      localUrl: url,
      remotesEnabled: true,
      retainLabUrl: params.retainLabUrl,
    })
  ));
};
