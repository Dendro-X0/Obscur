"use client";

import { useMemo } from "react";
import type { IdentityState } from "@/app/features/auth/hooks/use-identity";
import type { RelayConnection } from "@/app/features/relays/hooks/relay-connection";
import type { AppStatusSnapshot } from "@/app/shared/app-status-snapshot";

type UseAppStatusSnapshotParams = Readonly<{
  identity: IdentityState;
  relayConnections: ReadonlyArray<RelayConnection>;
  inviteStatus?: AppStatusSnapshot["invite"]["status"];
  requestStatus?: AppStatusSnapshot["request"]["status"];
  groupStatus?: AppStatusSnapshot["group"]["status"];
}>;

const deriveRelayStatus = (relayConnections: ReadonlyArray<RelayConnection>): AppStatusSnapshot["relay"]["status"] => {
  if (relayConnections.length === 0) {
    return "offline";
  }
  let openCount: number = 0;
  let errorCount: number = 0;
  let connectingCount: number = 0;
  relayConnections.forEach((conn: RelayConnection): void => {
    if (conn.status === "open") {
      openCount += 1;
      return;
    }
    if (conn.status === "error") {
      errorCount += 1;
      return;
    }
    connectingCount += 1;
  });
  if (openCount > 0 && errorCount === 0) {
    return "connected";
  }
  if (openCount > 0 && errorCount > 0) {
    return "degraded";
  }
  if (connectingCount > 0) {
    return "connecting";
  }
  return "offline";
};

const deriveIdentityStatus = (identity: IdentityState): AppStatusSnapshot["identity"]["status"] => {
  if (identity.status === "unlocked") {
    return "unlocked";
  }
  if (identity.status === "locked") {
    return "locked";
  }
  return "unknown";
};

export const useAppStatusSnapshot = (params: UseAppStatusSnapshotParams): AppStatusSnapshot => {
  return useMemo((): AppStatusSnapshot => {
    return {
      identity: { status: deriveIdentityStatus(params.identity) },
      invite: { status: params.inviteStatus ?? "none" },
      request: { status: params.requestStatus ?? "none" },
      relay: { status: deriveRelayStatus(params.relayConnections) },
      group: { status: params.groupStatus ?? "not_member" }
    };
  }, [params.groupStatus, params.identity, params.inviteStatus, params.relayConnections, params.requestStatus]);
};
