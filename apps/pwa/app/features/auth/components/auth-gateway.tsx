"use client";

import type React from "react";
import { useEffect, useState } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
  getAuthTokenStorageKeyCandidates,
  getRememberMeStorageKeyCandidates,
} from "@/app/features/auth/utils/auth-storage-keys";
import { ProfileBoundAuthShell } from "@/app/features/runtime/components/profile-bound-auth-shell";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";

interface AuthGatewayProps {
  children: React.ReactNode;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({ children }) => {
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const [hasAttemptedAutoUnlock, setHasAttemptedAutoUnlock] = useState(false);

  const isIdentityLocked = identity.state.status === "locked";
  const hasStoredIdentity = !!identity.state.stored;
  const shouldResolveStoredSession = isIdentityLocked && hasStoredIdentity && !hasAttemptedAutoUnlock;

  useEffect(() => {
    if (identity.state.status === "loading") {
      return;
    }
    if (!shouldResolveStoredSession) {
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      const profileId = runtime.snapshot.session.profileId;
      const rememberKeys = getRememberMeStorageKeyCandidates({ profileId, includeLegacy: true });
      const tokenKeys = getAuthTokenStorageKeyCandidates({ profileId, includeLegacy: true });
      const rememberedRaw = rememberKeys
        .map((key) => localStorage.getItem(key))
        .find((value): value is string => value !== null);
      const token = tokenKeys
        .map((key) => localStorage.getItem(key))
        .find((value): value is string => value !== null && value.length > 0);
      const isRemembered = rememberedRaw === "true";
      if (isRemembered && token) {
        try {
          await runtime.unlockBoundProfile({ passphrase: token as Passphrase });
        } catch {
          rememberKeys.forEach((key) => {
            localStorage.setItem(key, "false");
          });
          tokenKeys.forEach((key) => {
            localStorage.removeItem(key);
          });
        }
      }
      if (!cancelled) {
        setHasAttemptedAutoUnlock(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [identity.state.status, runtime, shouldResolveStoredSession]);

  if (runtime.snapshot.phase === "activating_runtime" || runtime.snapshot.phase === "ready" || runtime.snapshot.phase === "degraded") {
    return <>{children}</>;
  }

  return <ProfileBoundAuthShell />;
};
