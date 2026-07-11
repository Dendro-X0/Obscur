"use client";

import { useEffect, useRef } from "react";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { reconcileLocalDevWorkspaceRelay } from "../services/workspace-dev-relay-bootstrap";
import type { useRelayList } from "../hooks/use-relay-list";

type RelayListApi = Pick<ReturnType<typeof useRelayList>, "state" | "replaceRelays">;

type WorkspaceDevRelayBootstrapOwnerProps = Readonly<{
  enabled: boolean;
  relayList: RelayListApi;
  onBootstrapApplied?: () => void;
}>;

/**
 * When the dev workspace relay is listening on :7000, enable it automatically.
 * When it is offline, disable it so dead localhost does not block public relay publish.
 */
export const WorkspaceDevRelayBootstrapOwner = ({
  enabled,
  relayList,
  onBootstrapApplied,
}: WorkspaceDevRelayBootstrapOwnerProps): null => {
  const relayListRef = useRef(relayList);
  relayListRef.current = relayList;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      const result = await reconcileLocalDevWorkspaceRelay({
        relays: relayListRef.current.state.relays,
      });
      if (cancelled || !result?.changed) {
        return;
      }

      relayListRef.current.replaceRelays({ relays: result.relays });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("obscur:operator-trust-config-changed"));
      }
      onBootstrapApplied?.();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, onBootstrapApplied]);

  return null;
};
