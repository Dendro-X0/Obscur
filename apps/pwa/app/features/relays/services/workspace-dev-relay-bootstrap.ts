import { writeOperatorWorkspaceRelayUrl } from "@/app/features/groups/services/operator-trust-config";
import {
  normalizeWorkspaceRelayUrl,
} from "@/app/features/groups/services/workspace-relay-url";
import { LOCAL_DEV_RELAY_URL } from "../hooks/use-relay-list";

export type RelayListEntry = Readonly<{
  url: string;
  enabled: boolean;
}>;

export type WorkspaceDevRelayBootstrapResult = Readonly<{
  relays: ReadonlyArray<RelayListEntry>;
  workspaceRelayUrl: string;
  changed: boolean;
}>;

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

export const bootstrapLocalDevWorkspaceRelay = async (params: Readonly<{
  relays: ReadonlyArray<RelayListEntry>;
  localRelayUrl?: string;
}>): Promise<WorkspaceDevRelayBootstrapResult | null> => {
  const localRelayUrl = params.localRelayUrl ?? LOCAL_DEV_RELAY_URL;
  const reachable = await probeLocalDevWorkspaceRelay(localRelayUrl);
  if (!reachable) {
    return null;
  }

  const result = applyWorkspaceDevRelayBootstrap(params.relays, localRelayUrl);
  if (result.changed) {
    writeOperatorWorkspaceRelayUrl(result.workspaceRelayUrl);
  }
  return result;
};
