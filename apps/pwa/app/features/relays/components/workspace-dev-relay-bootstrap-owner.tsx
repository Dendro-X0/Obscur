"use client";

import { useEffect, useRef } from "react";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { bootstrapLocalDevWorkspaceRelay } from "../services/workspace-dev-relay-bootstrap";
import type { useRelayList } from "../hooks/use-relay-list";

type RelayListApi = Pick<ReturnType<typeof useRelayList>, "state" | "replaceRelays">;

type WorkspaceDevRelayBootstrapOwnerProps = Readonly<{
  enabled: boolean;
  relayList: RelayListApi;
  onBootstrapApplied?: () => void;
}>;

/**
 * When the dev workspace relay is listening on :7000, enable it automatically
 * so online desktop sessions connect without manual Settings → Relays toggles.
 */
export const WorkspaceDevRelayBootstrapOwner = ({
  enabled,
  relayList,
  onBootstrapApplied,
}: WorkspaceDevRelayBootstrapOwnerProps): null => {
  const appliedRef = useRef(false);
  const relayListRef = useRef(relayList);
  relayListRef.current = relayList;

  useEffect(() => {
    if (!enabled || appliedRef.current) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      const result = await bootstrapLocalDevWorkspaceRelay({
        relays: relayListRef.current.state.relays,
      });
      if (cancelled || !result?.changed) {
        return;
      }

      appliedRef.current = true;
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
