"use client";

import { useEffect } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
  ACTIVE_SESSION_LEASE_HEARTBEAT_MS,
  claimActiveSessionLease,
  releaseActiveSessionLease,
  touchActiveSessionLease,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";

/** Keeps cross-window active-session leases fresh while this profile window stays unlocked. */
export function ActiveSessionLeaseOwner(): null {
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const profileId = runtime.snapshot.session.profileId;
  const windowLabel = runtime.snapshot.session.windowLabel;
  const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;

  useEffect(() => {
    if (identity.state.status !== "unlocked" || !publicKeyHex) {
      return;
    }
    claimActiveSessionLease({
      publicKeyHex,
      profileId,
      windowLabel,
    });
    const heartbeatId = window.setInterval(() => {
      touchActiveSessionLease({ publicKeyHex, profileId });
    }, ACTIVE_SESSION_LEASE_HEARTBEAT_MS);
    const release = (): void => {
      releaseActiveSessionLease({ publicKeyHex, profileId });
    };
    window.addEventListener("pagehide", release);
    return (): void => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [identity.state.status, profileId, publicKeyHex, windowLabel]);

  useEffect(() => {
    if (identity.state.status !== "locked" || !publicKeyHex) {
      return;
    }
    releaseActiveSessionLease({ publicKeyHex, profileId });
  }, [identity.state.status, profileId, publicKeyHex]);

  return null;
}
