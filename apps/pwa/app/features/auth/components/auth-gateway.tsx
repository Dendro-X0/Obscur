"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
  isRememberMeEnabledForProfile,
  scanStoredSessionBootstrap,
} from "@/app/features/auth/services/session-bootstrap-contracts";
import { SESSION_AUTO_UNLOCK_ENABLED, NATIVE_SECURE_SESSION_RESTORE_ENABLED } from "@/app/features/auth/services/session-credential-policy";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { ProfileBoundAuthShell } from "@/app/features/runtime/components/profile-bound-auth-shell";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PendingProfileImportResume } from "@/app/features/profiles/components/pending-profile-import-resume";
import { AccountActiveInOtherProfileWindowError } from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { DevLabAuthBridge } from "@/app/features/dev-lab/dev-lab-auth-bridge";
import {
  isAuthPublicProfileRoute,
  PROFILE_SIGN_IN_ROUTE,
  resolveLockedDesktopEntryRedirect,
  resolveUnlockedDesktopRouteRedirect,
} from "@/app/features/profiles/services/auth-public-routes";
import { readShowProfilePickerOnStartup } from "@/app/features/profiles/services/profile-picker-startup-policy";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { resolveProfileLaunchMode } from "@/app/features/profiles/services/resolve-profile-launch-mode";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { isDeviceSessionRestoreAllowed } from "@/app/features/auth/services/device-session-consent";

const isUnlockedRuntimePhase = (phase: string): boolean => (
  phase === "activating_runtime" || phase === "ready" || phase === "degraded"
);

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
  const pathname = usePathname();
  const router = useRouter();
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const desktopProfileSnapshot = useDesktopProfileIsolationSnapshot();
  const isUnlocked = isUnlockedRuntimePhase(runtime.snapshot.phase);
  const isPublicProfileRoute = isAuthPublicProfileRoute(pathname) && hasNativeRuntime();
  const attemptedAutoUnlockProfileIdsRef = useRef<Set<string>>(new Set());
  const transientRetryStateByProfileIdRef = useRef<Record<string, TransientRetryState>>({});
  const [attemptedAutoUnlockProfileIds, setAttemptedAutoUnlockProfileIds] = useState<ReadonlyArray<string>>([]);
  const [transientRetryStateByProfileId, setTransientRetryStateByProfileId] = useState<Readonly<Record<string, TransientRetryState>>>({});
  const [retryWakeNonce, setRetryWakeNonce] = useState(0);

  const markAutoUnlockAttempted = (profileId: string): void => {
    if (attemptedAutoUnlockProfileIdsRef.current.has(profileId)) {
      return;
    }
    attemptedAutoUnlockProfileIdsRef.current.add(profileId);
    setAttemptedAutoUnlockProfileIds((previous) => (
      previous.includes(profileId) ? previous : [...previous, profileId]
    ));
  };

  const startupState = runtime.snapshot.session.startupState;
  const activeProfileId = runtime.snapshot.session.profileId;
  const hasAttemptedForActiveProfile = attemptedAutoUnlockProfileIdsRef.current.has(activeProfileId)
    || attemptedAutoUnlockProfileIds.includes(activeProfileId);
  const transientRetryState = transientRetryStateByProfileId[activeProfileId];
  const isTransientRetryDue = Boolean(
    transientRetryState
    && transientRetryState.count > 0
    && transientRetryState.count < AUTO_UNLOCK_MAX_TRANSIENT_RETRIES
    && retryWakeNonce >= transientRetryState.wakeNonceRequired,
  );
  const hasDeviceStoredIdentity = Boolean(identity.state.stored?.publicKeyHex);
  const rememberMeEnabledForProfile = isRememberMeEnabledForProfile(activeProfileId);
  const shouldAttemptRememberMeRestore = hasDeviceStoredIdentity && rememberMeEnabledForProfile;
  const shouldResolveStoredSession = SESSION_AUTO_UNLOCK_ENABLED && (
    (runtime.snapshot.phase === "auth_required" || runtime.snapshot.phase === "binding_profile")
    && (
      startupState.kind === "stored_locked"
      || startupState.kind === "mismatch"
      || startupState.kind === "native_restorable"
      || shouldAttemptRememberMeRestore
    )
    && (!hasAttemptedForActiveProfile || isTransientRetryDue)
  );
  const shouldAttemptNativeSecureRestore = (
    !SESSION_AUTO_UNLOCK_ENABLED
    && NATIVE_SECURE_SESSION_RESTORE_ENABLED
    && hasNativeRuntime()
    && isDeviceSessionRestoreAllowed(activeProfileId)
    && Boolean(identity.state.stored?.publicKeyHex)
    && identity.state.status === "locked"
    && (runtime.snapshot.phase === "auth_required" || runtime.snapshot.phase === "binding_profile")
    && !hasAttemptedForActiveProfile
  );

  useEffect(() => {
    const redirectTarget = resolveLockedDesktopEntryRedirect({
      pathname,
      isDesktopNative: hasNativeRuntime(),
      isUnlocked,
      showProfilePickerOnStartup: readShowProfilePickerOnStartup(),
      profileLaunchMode: resolveProfileLaunchMode(
        desktopProfileSnapshot.currentWindow.windowLabel,
        desktopProfileSnapshot.currentWindow.launchMode,
      ),
    });
    if (!redirectTarget) {
      return;
    }
    router.replace(redirectTarget);
  }, [
    desktopProfileSnapshot.currentWindow.launchMode,
    desktopProfileSnapshot.currentWindow.windowLabel,
    isUnlocked,
    pathname,
    router,
  ]);

  useEffect(() => {
    const redirectTarget = resolveUnlockedDesktopRouteRedirect({
      pathname,
      isDesktopNative: hasNativeRuntime(),
      isUnlocked,
    });
    if (!redirectTarget) {
      return;
    }
    router.replace(redirectTarget);
  }, [isUnlocked, pathname, router]);

  useEffect(() => {
    if (startupState.identityStatus === "loading" || identity.state.status === "loading") {
      return;
    }
    if (!shouldAttemptNativeSecureRestore || typeof identity.retryNativeSessionUnlock !== "function") {
      return;
    }
    const profileId = runtime.snapshot.session.profileId;
    markAutoUnlockAttempted(profileId);
    let cancelled = false;
    void (async () => {
      try {
        const unlocked = await identity.retryNativeSessionUnlock!();
        if (cancelled) {
          return;
        }
        if (unlocked) {
          reconcileWindowRuntimeBinding();
          logAppEvent({
            name: "auth.native_secure_restore_succeeded",
            level: "info",
            scope: { feature: "auth", action: "native_secure_restore" },
            context: { profileId },
          });
        }
      } catch (error) {
        if (error instanceof AccountActiveInOtherProfileWindowError) {
          return;
        }
        throw error;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    identity.retryNativeSessionUnlock,
    identity.state.status,
    identity.state.stored?.publicKeyHex,
    runtime.snapshot.phase,
    runtime.snapshot.session.profileId,
    shouldAttemptNativeSecureRestore,
    startupState.identityStatus,
  ]);

  useEffect(() => {
    if (startupState.identityStatus === "loading" || identity.state.status === "loading") {
      return;
    }
    if (!shouldResolveStoredSession) {
      return;
    }
    const profileId = runtime.snapshot.session.profileId;
    markAutoUnlockAttempted(profileId);
    let cancelled = false;
    let retryTimerId: number | null = null;
    const run = async (): Promise<void> => {
      let unlocked = false;
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
      const tryNativeSessionRecover = async (): Promise<boolean> => {
        if (!isRemembered || typeof identity.retryNativeSessionUnlock !== "function") {
          return false;
        }
        try {
          return await identity.retryNativeSessionUnlock();
        } catch {
          return false;
        }
      };

      const tryUnlockWithCandidate = async (candidateToken: string): Promise<void> => {
        const decodedPrivateKeyHex = decodePrivateKey(candidateToken);
        if (decodedPrivateKeyHex) {
          await runtime.unlockBoundProfileWithPrivateKeyHex({ privateKeyHex: decodedPrivateKeyHex });
          return;
        }
        await runtime.unlockBoundProfile({ passphrase: candidateToken as Passphrase });
      };

      if (autoUnlockEligible || isRemembered) {
        let allFailuresLookCredentialRelated = true;
        for (const candidateToken of uniqueTokenCandidates) {
          try {
            await tryUnlockWithCandidate(candidateToken);
            unlocked = true;
            break;
          } catch (error) {
            if (error instanceof AccountActiveInOtherProfileWindowError) {
              return;
            }
            if (!isLikelyCredentialFailure(error)) {
              allFailuresLookCredentialRelated = false;
            }
            // Try next token candidate before clearing remembered auth state.
          }
        }
        if (!unlocked && isRemembered) {
          unlocked = await tryNativeSessionRecover();
          if (unlocked) {
            setTransientRetryStateByProfileId((previous) => {
              if (!previous[profileId]) {
                return previous;
              }
              const next = { ...previous };
              delete next[profileId];
              transientRetryStateByProfileIdRef.current = next;
              return next;
            });
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
            transientRetryStateByProfileIdRef.current = next;
            return next;
          });
        } else if (!unlocked && !allFailuresLookCredentialRelated) {
          const previousRetryState = transientRetryStateByProfileIdRef.current[profileId];
          const nextRetryCount = (previousRetryState?.count ?? 0) + 1;
          if (nextRetryCount < AUTO_UNLOCK_MAX_TRANSIENT_RETRIES) {
            const nextRetryAtUnixMs = Date.now() + AUTO_UNLOCK_TRANSIENT_RETRY_DELAY_MS;
            setTransientRetryStateByProfileId((previous) => {
              const next = {
                ...previous,
                [profileId]: {
                  count: nextRetryCount,
                  nextRetryAtUnixMs,
                  wakeNonceRequired: retryWakeNonce + 1,
                },
              };
              transientRetryStateByProfileIdRef.current = next;
              return next;
            });
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
            transientRetryStateByProfileIdRef.current = next;
            return next;
          });
        }
      } else if (isRemembered) {
        const nativeSessionRecovered = await tryNativeSessionRecover();
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
    };
    void run();
    return () => {
      cancelled = true;
      if (retryTimerId !== null) {
        window.clearTimeout(retryTimerId);
      }
    };
  }, [
    identity.retryNativeSessionUnlock,
    identity.state.stored?.publicKeyHex,
    rememberMeEnabledForProfile,
    retryWakeNonce,
    runtime.snapshot.phase,
    runtime.snapshot.session.profileId,
    runtime.unlockBoundProfile,
    runtime.unlockBoundProfileWithPrivateKeyHex,
    shouldResolveStoredSession,
    identity.state.status,
    startupState.identityStatus,
    startupState.kind,
  ]);

  if (isPublicProfileRoute) {
    return (
      <>
        <DevLabAuthBridge />
        {children}
      </>
    );
  }

  if (isUnlocked) {
    const resolveActivePrivateKeyHex = async (): Promise<PrivateKeyHex | null> => {
      if (identity.state.status !== "unlocked" || !identity.state.privateKeyHex) {
        return null;
      }
      return identity.state.privateKeyHex as PrivateKeyHex;
    };

    return (
      <>
        <DevLabAuthBridge />
        <PendingProfileImportResume
          publicKeyHex={(identity.state.publicKeyHex as PublicKeyHex | null) ?? null}
          resolveActivePrivateKeyHex={resolveActivePrivateKeyHex}
        />
        {children}
      </>
    );
  }

  if (runtime.snapshot.phase === "unlocking") {
    return (
      <>
        <DevLabAuthBridge />
        <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Unlocking profile…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <DevLabAuthBridge />
      <ProfileBoundAuthShell />
    </>
  );
};
