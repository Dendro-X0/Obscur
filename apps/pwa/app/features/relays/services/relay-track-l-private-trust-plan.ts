/**
 * Relay diagnostics Slice C — one-shot Track L / private-trust relay layout.
 * Enable local WS lab, disable public remotes + invalid schemes, nominate local primary.
 */

import {
  isLocalDevWorkspaceRelayUrl,
  isLocalMeshHttpGatewayUrl,
  LOCAL_DEV_WORKSPACE_RELAY_URL,
} from "./relay-transport-scope";
import { classifyRelayUrlSchemeKind } from "./relay-path-diagnosis";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

export type TrackLRelayRow = Readonly<{
  url: string;
  enabled: boolean;
}>;

export type TrackLPrivateTrustPlan = Readonly<{
  relays: ReadonlyArray<TrackLRelayRow>;
  primaryUrl: string;
  retainLabUrl: string;
  changed: boolean;
  enabledLocal: boolean;
  disabledRemoteCount: number;
  disabledInvalidCount: number;
}>;

const shouldEnableInTrackLPlan = (url: string): boolean => {
  if (classifyRelayUrlSchemeKind(url) === "invalid_scheme") {
    return false;
  }
  if (isLocalMeshHttpGatewayUrl(url)) {
    return false;
  }
  return isLocalDevWorkspaceRelayUrl(url);
};

/**
 * Pure plan: local `:7000` on, publics/invalid/mesh-HTTP off, primary = local.
 */
export const buildTrackLPrivateTrustRelayPlan = (
  current: ReadonlyArray<TrackLRelayRow>,
): TrackLPrivateTrustPlan => {
  const primaryUrl = LOCAL_DEV_WORKSPACE_RELAY_URL;
  const rows = new Map<string, TrackLRelayRow>();

  current.forEach((row) => {
    const url = row.url.trim();
    if (!url) {
      return;
    }
    rows.set(url, {
      url,
      enabled: shouldEnableInTrackLPlan(url),
    });
  });

  if (![...rows.keys()].some((url) => isLocalDevWorkspaceRelayUrl(url))) {
    rows.set(primaryUrl, { url: primaryUrl, enabled: true });
  } else {
    // Force-enable every matching local WS lab row.
    [...rows.entries()].forEach(([url, row]) => {
      if (isLocalDevWorkspaceRelayUrl(url)) {
        rows.set(url, { ...row, enabled: true });
      }
    });
  }

  const relays = [...rows.values()];
  let disabledRemoteCount = 0;
  let disabledInvalidCount = 0;
  relays.forEach((row) => {
    if (row.enabled) {
      return;
    }
    if (classifyRelayUrlSchemeKind(row.url) === "invalid_scheme" || isLocalMeshHttpGatewayUrl(row.url)) {
      disabledInvalidCount += 1;
      return;
    }
    if (!isLocalDevWorkspaceRelayUrl(row.url)) {
      disabledRemoteCount += 1;
    }
  });

  const changed = relays.length !== current.length
    || relays.some((row) => {
      const prior = current.find((entry) => (
        entry.url === row.url || workspaceRelayUrlsMatch(entry.url, row.url)
      ));
      return !prior || prior.enabled !== row.enabled;
    });

  return {
    relays,
    primaryUrl,
    retainLabUrl: primaryUrl,
    changed,
    enabledLocal: relays.some((row) => row.enabled && isLocalDevWorkspaceRelayUrl(row.url)),
    disabledRemoteCount,
    disabledInvalidCount,
  };
};
