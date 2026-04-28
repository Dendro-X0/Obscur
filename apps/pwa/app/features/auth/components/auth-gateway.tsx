"use client";

import type React from "react";
import { useEffect, useState } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { scanStoredSessionBootstrap } from "@/app/features/auth/services/session-bootstrap-contracts";
import { ProfileBoundAuthShell } from "@/app/features/runtime/components/profile-bound-auth-shell";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { logAppEvent } from "@/app/shared/log-app-event";

interface AuthGatewayProps {
  children: React.ReactNode;
}

const AUTO_UNLOCK_TRANSIENT_RETRY_DELAY_MS = 1500;
const AUTO_UNLOCK_MAX_TRANSIENT_RETRIES = 8;
type TransientRetryState = Readonly<{
  count: number;
  nextRetryAtUnixMs: number;
  wakeNonceRequired: number;
}>;

const isLikelyCredentialFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("operationerror")
    || normalized.includes("unable to authenticate")
    || normalized.includes("decrypt")
    || normalized.includes("unlock_failed")
    || normalized.includes("incorrect")
    || normalized.includes("invalid")
    || normalized.includes("passphrase")
    || normalized.includes("password")
    || normalized.includes("private key does not match")
    || normalized.includes("without a local password");
};

export const AuthGateway: React.FC<AuthGatewayProps> = ({ children }) => {
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const [attemptedAutoUnlockProfileIds, setAttemptedAutoUnlockProfileIds] = useState<ReadonlyArray<string>>([]);
  const [transientRetryStateByProfileId, setTransientRetryStateByProfileId] = useState<Readonly<Record<string, TransientRetryState>>>({});
  const [retryWakeNonce, setRetryWakeNonce] = useState(0);

  const startupState = runtime.snapshot.session.startupState;
  const activeProfileId = runtime.snapshot.session.profileId;
  const hasAttemptedForActiveProfile = attemptedAutoUnlockProfileIds.includes(activeProfileId);
  const transientRetryState = transientRetryStateByProfileId[activeProfileId];
  const isTransientRetryDue = Boolean(
    transientRetryState
    && transientRetryState.count > 0
    && transientRetryState.count < AUTO_UNLOCK_MAX_TRANSIENT_RETRIES
    && retryWakeNonce >= transientRetryState.wakeNonceRequired,
  );
  const shouldResolveStoredSession = (
    runtime.snapshot.phase === "auth_required"
    && (startupState.kind === "stored_locked" || startupState.kind === "mismatch" || startupState.kind === "native_restorable")
    && (!hasAttemptedForActiveProfile || isTransientRetryDue)
  );

  useEffect(() => {
    if (startupState.identityStatus === "loading") {
      return;
    }
    if (!shouldResolveStoredSession) {
      return;
    }
    let cancelled = false;
    let retryTimerId: number | null = null;
    const run = async (): Promise<void> => {
      const profileId = runtime.snapshot.session.profileId;
      const bootstrapScan = scanStoredSessionBootstrap(profileId);
      const uniqueTokenCandidates = bootstrapScan.tokenCandidates;
      const isRemembered = bootstrapScan.rememberMeState === "enabled";
      const autoUnlockEligible = bootstrapScan.autoUnlockEligible;
      logAppEvent({
        name: "auth.auto_unlock_scan",
        level: "info",
        scope: { feature: "auth", action: "auto_unlock" },
        context: {
          profileId,
          rememberCandidateCount: bootstrapScan.rememberCandidateCount,
          rememberedTrue: isRemembered,
          tokenCandidateCount: bootstrapScan.tokenCandidateCount,
          autoUnlockEligible,
          autoUnlockPath: bootstrapScan.autoUnlockPath,
          rememberSource: bootstrapScan.rememberSource,
          tokenSource: bootstrapScan.tokenSource,
          scopedRememberCandidateCount: bootstrapScan.rememberCandidateCount,
          scopedTokenCandidateCount: bootstrapScan.tokenCandidateCount,
          runtimePhase: runtime.snapshot.phase,
          identityStatus: startupState.identityStatus,
          startupDecision: startupState.kind,
        },
      });
      if (autoUnlockEligible) {
        let unlocked = false;
        let allFailuresLookCredentialRelated = true;
        for (const candidateToken of uniqueTokenCandidates) {
          try {
            await runtime.unlockBoundProfile({ passphrase: candidateToken as Passphrase });
            unlocked = true;
            break;
          } catch (error) {
            if (!isLikelyCredentialFailure(error)) {
              allFailuresLookCredentialRelated = false;
            }
            // Try next token candidate before clearing remembered auth state.
          }
        }
        if (!unlocked && allFailuresLookCredentialRelated) {
          // Preserve remembered credentials for manual recovery; failed auto-unlock
          // is not strong evidence that local secrets should be deleted.
          logAppEvent({
            name: "auth.auto_unlock_credentials_rejected_preserved",
            level: "warn",
            scope: { feature: "auth", action: "auto_unlock" },
            context: {
              profileId,
              scopedRememberCandidateCount: bootstrapScan.rememberCandidateCount,
              scopedTokenCandidateCount: bootstrapScan.tokenCandidateCount,
            },
          });
          setTransientRetryStateByProfileId((previous) => {
            if (!previous[profileId]) {
              return previous;
            }
            const next = { ...previous };
            delete next[profileId];
            return next;
          });
        } else if (!unlocked && !allFailuresLookCredentialRelated) {
          const previousRetryState = transientRetryStateByProfileId[profileId];
          const nextRetryCount = (previousRetryState?.count ?? 0) + 1;
          if (nextRetryCount < AUTO_UNLOCK_MAX_TRANSIENT_RETRIES) {
            const nextRetryAtUnixMs = Date.now() + AUTO_UNLOCK_TRANSIENT_RETRY_DELAY_MS;
            setTransientRetryStateByProfileId((previous) => ({
              ...previous,
              [profileId]: {
                count: nextRetryCount,
                nextRetryAtUnixMs,
                wakeNonceRequired: retryWakeNonce + 1,
              },
            }));
            retryTimerId = window.setTimeout(() => {
              if (!cancelled) {
                setRetryWakeNonce((current) => current + 1);
              }
            }, AUTO_UNLOCK_TRANSIENT_RETRY_DELAY_MS);
          }
          logAppEvent({
            name: "auth.auto_unlock_preserved_credentials_for_retry",
            level: "warn",
            scope: { feature: "auth", action: "auto_unlock" },
            context: {
              profileId,
              candidateCount: uniqueTokenCandidates.length,
              transientRetryCount: nextRetryCount,
            },
          });
        } else if (unlocked) {
          setTransientRetryStateByProfileId((previous) => {
            if (!previous[profileId]) {
              return previous;
            }
            const next = { ...previous };
            delete next[profileId];
            return next;
          });
        }
      } else {
        let nativeSessionRecovered = false;
        if (
          bootstrapScan.autoUnlockPath === "native_session"
          && typeof identity.retryNativeSessionUnlock === "function"
        ) {
          try {
            nativeSessionRecovered = await identity.retryNativeSessionUnlock();
          } catch {
            nativeSessionRecovered = false;
          }
          if (nativeSessionRecovered) {
            logAppEvent({
              name: "auth.auto_unlock_recovered_native_session",
              level: "info",
              scope: { feature: "auth", action: "auto_unlock" },
              context: {
                profileId,
                rememberSource: bootstrapScan.rememberSource,
                tokenSource: bootstrapScan.tokenSource,
                scopedRememberCandidateCount: bootstrapScan.rememberCandidateCount,
                runtimePhase: runtime.snapshot.phase,
              },
            });
          }
        }
        if (nativeSessionRecovered) {
          setTransientRetryStateByProfileId((previous) => {
            if (!previous[profileId]) {
              return previous;
            }
            const next = { ...previous };
            delete next[profileId];
            return next;
          });
        } else {
          logAppEvent({
            name: "auth.auto_unlock_skipped_missing_credentials",
            level: "info",
            scope: { feature: "auth", action: "auto_unlock" },
            context: {
              profileId,
              rememberedTrue: isRemembered,
              tokenCandidateCount: bootstrapScan.tokenCandidateCount,
              autoUnlockEligible,
              autoUnlockPath: bootstrapScan.autoUnlockPath,
              rememberSource: bootstrapScan.rememberSource,
              tokenSource: bootstrapScan.tokenSource,
              scopedRememberCandidateCount: bootstrapScan.rememberCandidateCount,
              scopedTokenCandidateCount: bootstrapScan.tokenCandidateCount,
              runtimePhase: runtime.snapshot.phase,
            },
          });
        }
      }
      if (!cancelled) {
        setAttemptedAutoUnlockProfileIds((previous) => (
          previous.includes(profileId)
            ? previous
            : [...previous, profileId]
        ));
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (retryTimerId !== null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [identity, retryWakeNonce, runtime, shouldResolveStoredSession, startupState.identityStatus, transientRetryStateByProfileId]);

  if (runtime.snapshot.phase === "activating_runtime" || runtime.snapshot.phase === "ready" || runtime.snapshot.phase === "degraded") {
    return <>{children}</>;
  }

  return <ProfileBoundAuthShell />;
};
