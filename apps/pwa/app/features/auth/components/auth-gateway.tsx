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
import { logAppEvent } from "@/app/shared/log-app-event";

interface AuthGatewayProps {
  children: React.ReactNode;
}

const AUTO_UNLOCK_TRANSIENT_RETRY_DELAY_MS = 1500;
const AUTO_UNLOCK_MAX_TRANSIENT_RETRIES = 8;
const REMEMBER_ME_BASE_KEY = "obscur_remember_me";
const AUTH_TOKEN_BASE_KEY = "obscur_auth_token";

type TransientRetryState = Readonly<{
  count: number;
  nextRetryAtUnixMs: number;
}>;

const collectScopedStorageValues = (baseKey: string): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  const values: string[] = [];
  const scopedPrefix = `${baseKey}::`;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    if (key === baseKey || key.startsWith(scopedPrefix)) {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        values.push(value);
      }
    }
  }
  return values;
};

const collectScopedStorageProfileIds = (baseKey: string): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  const scopedPrefix = `${baseKey}::`;
  const profileIds = new Set<string>();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const value = window.localStorage.getItem(key);
    if (key === baseKey && value && value.length > 0) {
      profileIds.add("default");
      continue;
    }
    if (key.startsWith(scopedPrefix) && value && value.length > 0) {
      profileIds.add(key.slice(scopedPrefix.length));
    }
  }
  return [...profileIds];
};

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

  const isIdentityLocked = identity.state.status === "locked";
  const hasStoredIdentity = !!identity.state.stored;
  const activeProfileId = runtime.snapshot.session.profileId;
  const hasAttemptedForActiveProfile = attemptedAutoUnlockProfileIds.includes(activeProfileId);
  const transientRetryState = transientRetryStateByProfileId[activeProfileId];
  const transientRetryCount = transientRetryState?.count ?? 0;
  const isTransientRetryDue = Boolean(
    transientRetryState
    && transientRetryState.count > 0
    && transientRetryState.count < AUTO_UNLOCK_MAX_TRANSIENT_RETRIES
    && Date.now() >= transientRetryState.nextRetryAtUnixMs,
  );
  const shouldResolveStoredSession = (
    runtime.snapshot.phase === "auth_required"
    && isIdentityLocked
    && hasStoredIdentity
    && (!hasAttemptedForActiveProfile || isTransientRetryDue)
  );

  useEffect(() => {
    if (identity.state.status === "loading") {
      return;
    }
    if (!shouldResolveStoredSession) {
      return;
    }
    let cancelled = false;
    let retryTimerId: number | null = null;
    const run = async (): Promise<void> => {
      const profileId = runtime.snapshot.session.profileId;
      const rememberKeys = getRememberMeStorageKeyCandidates({ profileId, includeLegacy: true });
      const tokenKeys = getAuthTokenStorageKeyCandidates({ profileId, includeLegacy: true });
      const rememberedValues = rememberKeys
        .map((key) => localStorage.getItem(key))
        .filter((value): value is string => value !== null);
      const fallbackRememberedValues = collectScopedStorageValues(REMEMBER_ME_BASE_KEY);
      const tokenCandidates = tokenKeys
        .map((key) => localStorage.getItem(key))
        .filter((value): value is string => value !== null && value.length > 0);
      const fallbackTokenCandidates = collectScopedStorageValues(AUTH_TOKEN_BASE_KEY)
        .filter((value): value is string => value.length > 0);
      // Prefer active-profile scoped keys. Use broad fallback only when scoped keys are absent.
      const effectiveRememberValues = rememberedValues.length > 0
        ? rememberedValues
        : fallbackRememberedValues;
      const effectiveTokenCandidates = tokenCandidates.length > 0
        ? tokenCandidates
        : fallbackTokenCandidates;
      const uniqueTokenCandidates = Array.from(new Set(effectiveTokenCandidates));
      const isRemembered = effectiveRememberValues.some((value) => value === "true");
      const hasTokenCandidates = uniqueTokenCandidates.length > 0;
      const autoUnlockEligible = hasTokenCandidates;
      const rememberSource = rememberedValues.length > 0 ? "scoped" : (fallbackRememberedValues.length > 0 ? "fallback" : "none");
      const tokenSource = tokenCandidates.length > 0 ? "scoped" : (fallbackTokenCandidates.length > 0 ? "fallback" : "none");
      const fallbackTokenProfileIds = tokenCandidates.length > 0
        ? []
        : collectScopedStorageProfileIds(AUTH_TOKEN_BASE_KEY);
      const fallbackRememberProfileIds = rememberedValues.length > 0
        ? []
        : collectScopedStorageProfileIds(REMEMBER_ME_BASE_KEY);
      const fallbackTokenCrossProfile = tokenSource === "fallback"
        && fallbackTokenProfileIds.some((candidateProfileId) => candidateProfileId !== profileId);
      const fallbackRememberCrossProfile = rememberSource === "fallback"
        && fallbackRememberProfileIds.some((candidateProfileId) => candidateProfileId !== profileId);
      if (fallbackTokenCrossProfile || fallbackRememberCrossProfile) {
        const driftReasonCode = fallbackTokenCrossProfile
          ? "fallback_token_profile_mismatch"
          : "fallback_remember_profile_mismatch";
        logAppEvent({
          name: "auth.auto_unlock_scope_drift_detected",
          level: "warn",
          scope: { feature: "auth", action: "auto_unlock" },
          context: {
            profileId,
            reasonCode: driftReasonCode,
            tokenSource,
            rememberSource,
            scopedTokenCandidateCount: tokenCandidates.length,
            fallbackTokenCandidateCount: fallbackTokenCandidates.length,
            scopedRememberCandidateCount: rememberedValues.length,
            fallbackRememberCandidateCount: fallbackRememberedValues.length,
            fallbackTokenProfileSample: fallbackTokenProfileIds.slice(0, 4).join("|") || "none",
            fallbackRememberProfileSample: fallbackRememberProfileIds.slice(0, 4).join("|") || "none",
          },
        });
      }
      logAppEvent({
        name: "auth.auto_unlock_scan",
        level: "info",
        scope: { feature: "auth", action: "auto_unlock" },
        context: {
          profileId,
          rememberCandidateCount: [...rememberedValues, ...fallbackRememberedValues].length,
          rememberedTrue: isRemembered,
          tokenCandidateCount: uniqueTokenCandidates.length,
          autoUnlockEligible,
          rememberSource,
          tokenSource,
          scopedRememberCandidateCount: rememberedValues.length,
          fallbackRememberCandidateCount: fallbackRememberedValues.length,
          scopedTokenCandidateCount: tokenCandidates.length,
          fallbackTokenCandidateCount: fallbackTokenCandidates.length,
          runtimePhase: runtime.snapshot.phase,
          identityStatus: identity.state.status,
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
              scopedRememberCandidateCount: rememberedValues.length,
              scopedTokenCandidateCount: tokenCandidates.length,
              fallbackRememberCandidateCount: fallbackRememberedValues.length,
              fallbackTokenCandidateCount: fallbackTokenCandidates.length,
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
          isRemembered
          && uniqueTokenCandidates.length === 0
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
                rememberSource,
                tokenSource,
                scopedRememberCandidateCount: rememberedValues.length,
                fallbackRememberCandidateCount: fallbackRememberedValues.length,
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
              tokenCandidateCount: uniqueTokenCandidates.length,
              autoUnlockEligible,
              rememberSource,
              tokenSource,
              scopedRememberCandidateCount: rememberedValues.length,
              fallbackRememberCandidateCount: fallbackRememberedValues.length,
              scopedTokenCandidateCount: tokenCandidates.length,
              fallbackTokenCandidateCount: fallbackTokenCandidates.length,
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
  }, [identity, identity.state.status, retryWakeNonce, runtime, shouldResolveStoredSession, transientRetryStateByProfileId]);

  if (runtime.snapshot.phase === "activating_runtime" || runtime.snapshot.phase === "ready" || runtime.snapshot.phase === "degraded") {
    return <>{children}</>;
  }

  return <ProfileBoundAuthShell />;
};
