"use client";

import { useEffect, useRef } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
  ACTIVE_SESSION_LEASE_HEARTBEAT_MS,
  claimActiveSessionLeaseAsync,
  releaseActiveSessionLeaseAsync,
  touchActiveSessionLeaseAsync,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";

/**
 * Keeps cross-window active-session leases fresh while this profile window stays unlocked.
 * Release only on true unmount / lock — not on every effect dep churn (was causing touch stampede).
 */
export function ActiveSessionLeaseOwner(): null {
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const profileId = runtime.snapshot.session.profileId;
  const windowLabel = runtime.snapshot.session.windowLabel;
  const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const status = identity.state.status;
  const leaseRef = useRef<Readonly<{ publicKeyHex: string; profileId: string }> | null>(null);

  useEffect(() => {
    if (status !== "unlocked" || !publicKeyHex) {
      return;
    }
    leaseRef.current = { publicKeyHex, profileId };
    void claimActiveSessionLeaseAsync({
      publicKeyHex,
      profileId,
      windowLabel,
    });
    const heartbeatId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void touchActiveSessionLeaseAsync({ publicKeyHex, profileId });
    }, ACTIVE_SESSION_LEASE_HEARTBEAT_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void touchActiveSessionLeaseAsync({ publicKeyHex, profileId });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return (): void => {
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", onVisibility);
      // Intentionally no release here — dep churn must not drop/reclaim the lease.
    };
  }, [status, profileId, publicKeyHex, windowLabel]);

  useEffect(() => {
    if (status !== "locked" || !publicKeyHex) {
      return;
    }
    void releaseActiveSessionLeaseAsync({ publicKeyHex, profileId });
    leaseRef.current = null;
  }, [status, profileId, publicKeyHex]);

  useEffect(() => {
    return (): void => {
      const lease = leaseRef.current;
      if (!lease) {
        return;
      }
      void releaseActiveSessionLeaseAsync({
        publicKeyHex: lease.publicKeyHex,
        profileId: lease.profileId,
      });
      leaseRef.current = null;
    };
  }, []);

  return null;
}
