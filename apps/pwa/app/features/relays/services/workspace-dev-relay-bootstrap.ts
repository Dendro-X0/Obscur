import {
  readOperatorWorkspaceRelayUrl,
  writeOperatorWorkspaceRelayUrl,
} from "@/app/features/groups/services/operator-trust-config";
import {
  normalizeWorkspaceRelayUrl,
} from "@/app/features/groups/services/workspace-relay-url";
import { LOCAL_DEV_RELAY_URL } from "../hooks/use-relay-list";
import { isLocalLabAssistRelayUrl } from "./relay-local-lab-adapt";
import { isLocalMeshHttpGatewayUrl } from "./relay-transport-scope";

export type RelayListEntry = Readonly<{
  url: string;
  enabled: boolean;
}>;

export type WorkspaceDevRelayBootstrapResult = Readonly<{
  relays: ReadonlyArray<RelayListEntry>;
  workspaceRelayUrl: string;
  changed: boolean;
}>;

const DEFAULT_LOCAL_HTTP_MESH_URL = "http://127.0.0.1:8788";

const relayUrlsMatch = (left: string, right: string): boolean => {
  const normalizedLeft = normalizeWorkspaceRelayUrl(left);
  const normalizedRight = normalizeWorkspaceRelayUrl(right);
  return normalizedLeft === normalizedRight;
};

/** Enable local workspace relay in the relay list when the dev stack is up. */
export const applyWorkspaceDevRelayBootstrap = (
  relays: ReadonlyArray<RelayListEntry>,
  localRelayUrl: string = LOCAL_DEV_RELAY_URL,
): WorkspaceDevRelayBootstrapResult => {
  const workspaceRelayUrl = normalizeWorkspaceRelayUrl(localRelayUrl) || localRelayUrl;
  let changed = false;
  let found = false;

  const next = relays.map((relay) => {
    if (!relayUrlsMatch(relay.url, workspaceRelayUrl)) {
      return relay;
    }
    found = true;
    if (!relay.enabled || relay.url !== workspaceRelayUrl) {
      changed = true;
      return { url: workspaceRelayUrl, enabled: true };
    }
    return relay;
  });

  if (!found) {
    changed = true;
    return {
      relays: [...next, { url: workspaceRelayUrl, enabled: true }],
      workspaceRelayUrl,
      changed: true,
    };
  }

  return { relays: next, workspaceRelayUrl, changed };
};

/** Disable local workspace relay when the dev stack is not listening. */
export const pruneUnreachableLocalDevWorkspaceRelay = (
  relays: ReadonlyArray<RelayListEntry>,
  localRelayUrl: string = LOCAL_DEV_RELAY_URL,
): WorkspaceDevRelayBootstrapResult | null => {
  const workspaceRelayUrl = normalizeWorkspaceRelayUrl(localRelayUrl) || localRelayUrl;
  const localEntry = relays.find((relay) => relayUrlsMatch(relay.url, workspaceRelayUrl));
  if (!localEntry?.enabled) {
    return null;
  }

  const next = relays.map((relay) => (
    relayUrlsMatch(relay.url, workspaceRelayUrl)
      ? { url: workspaceRelayUrl, enabled: false }
      : relay
  ));

  return {
    relays: next,
    workspaceRelayUrl,
    changed: true,
  };
};

/** Disable loopback HTTP mesh when the gateway is not listening. */
export const pruneUnreachableLocalMeshHttpGateway = (
  relays: ReadonlyArray<RelayListEntry>,
): WorkspaceDevRelayBootstrapResult | null => {
  const enabledMesh = relays.filter((relay) => (
    relay.enabled && isLocalMeshHttpGatewayUrl(relay.url)
  ));
  if (enabledMesh.length === 0) {
    return null;
  }
  const next = relays.map((relay) => (
    relay.enabled && isLocalMeshHttpGatewayUrl(relay.url)
      ? { url: relay.url, enabled: false }
      : relay
  ));
  return {
    relays: next,
    workspaceRelayUrl: enabledMesh[0]?.url ?? DEFAULT_LOCAL_HTTP_MESH_URL,
    changed: true,
  };
};

/** Best-effort probe for the local Docker/dev relay on ws://localhost:7000. */
export const probeLocalDevWorkspaceRelay = (
  localRelayUrl: string = LOCAL_DEV_RELAY_URL,
  timeoutMs = 2_500,
): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timerId);
      try {
        socket.close();
      } catch {
        // ignore
      }
      resolve(value);
    };

    let socket: WebSocket;
    try {
      socket = new WebSocket(localRelayUrl);
    } catch {
      finish(false);
      return;
    }

    const timerId = window.setTimeout(() => finish(false), timeoutMs);
    socket.onopen = () => finish(true);
    socket.onerror = () => finish(false);
  });
};

/** Best-effort health probe for loopback HTTP mesh gateway. */
export const probeLocalMeshHttpGateway = async (
  gatewayUrl: string = DEFAULT_LOCAL_HTTP_MESH_URL,
  timeoutMs = 2_000,
): Promise<boolean> => {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return false;
  }
  const base = gatewayUrl.trim().replace(/\/$/, "");
  if (!base) {
    return false;
  }
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/mesh/v1/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timerId);
  }
};

/** True when any enabled relay is a consumer remote (not Docker/8788 lab assist). */
export const hasEnabledNonLocalRelay = (
  relays: ReadonlyArray<RelayListEntry>,
  _localRelayUrl: string = LOCAL_DEV_RELAY_URL,
): boolean => relays.some((relay) => (
  relay.enabled && !isLocalLabAssistRelayUrl(relay.url)
));

export const reconcileLocalDevWorkspaceRelay = async (params: Readonly<{
  relays: ReadonlyArray<RelayListEntry>;
  localRelayUrl?: string;
}>): Promise<WorkspaceDevRelayBootstrapResult | null> => {
  const localRelayUrl = params.localRelayUrl ?? LOCAL_DEV_RELAY_URL;
  let relays = params.relays;
  let changed = false;
  let workspaceRelayUrl = localRelayUrl;

  const remotesEnabled = hasEnabledNonLocalRelay(relays, localRelayUrl);
  const operatorWorkspaceRelayUrl = readOperatorWorkspaceRelayUrl();

  // When public/VPS remotes are enabled, keep lab assists off (average-user path),
  // but never force-off the operator Team workspace relay the user just Saved.
  if (remotesEnabled) {
    const forceOffLab = relays.map((relay) => {
      if (!relay.enabled || !isLocalLabAssistRelayUrl(relay.url)) {
        return relay;
      }
      if (
        operatorWorkspaceRelayUrl
        && relayUrlsMatch(relay.url, operatorWorkspaceRelayUrl)
      ) {
        return relay;
      }
      return { url: relay.url, enabled: false };
    });
    if (forceOffLab.some((relay, index) => relay.enabled !== relays[index]?.enabled)) {
      return {
        relays: forceOffLab,
        workspaceRelayUrl: localRelayUrl,
        changed: true,
      };
    }
    return null;
  }

  const wsReachable = await probeLocalDevWorkspaceRelay(localRelayUrl);
  if (wsReachable) {
    const result = applyWorkspaceDevRelayBootstrap(relays, localRelayUrl);
    if (result.changed) {
      writeOperatorWorkspaceRelayUrl(result.workspaceRelayUrl);
      relays = result.relays;
      changed = true;
      workspaceRelayUrl = result.workspaceRelayUrl;
    }
  } else {
    const pruned = pruneUnreachableLocalDevWorkspaceRelay(relays, localRelayUrl);
    if (pruned?.changed) {
      relays = pruned.relays;
      changed = true;
      workspaceRelayUrl = pruned.workspaceRelayUrl;
    }
  }

  const enabledMeshUrls = relays
    .filter((relay) => relay.enabled && isLocalMeshHttpGatewayUrl(relay.url))
    .map((relay) => relay.url);
  if (enabledMeshUrls.length > 0) {
    const anyMeshUp = (await Promise.all(
      enabledMeshUrls.map((url) => probeLocalMeshHttpGateway(url)),
    )).some(Boolean);
    if (!anyMeshUp) {
      const prunedMesh = pruneUnreachableLocalMeshHttpGateway(relays);
      if (prunedMesh?.changed) {
        relays = prunedMesh.relays;
        changed = true;
        workspaceRelayUrl = prunedMesh.workspaceRelayUrl;
      }
    }
  }

  if (!changed) {
    return null;
  }
  return { relays, workspaceRelayUrl, changed: true };
};

export const bootstrapLocalDevWorkspaceRelay = async (params: Readonly<{
  relays: ReadonlyArray<RelayListEntry>;
  localRelayUrl?: string;
}>): Promise<WorkspaceDevRelayBootstrapResult | null> => {
  const result = await reconcileLocalDevWorkspaceRelay(params);
  return result;
};
