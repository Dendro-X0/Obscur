/**
 * AUTH-K2 — canonical native session boot restore owner (replaces scatter reload loops).
 */
import {
  getIdentitySnapshot,
  rehydrateAuthKernelIdentityForActiveProfile,
  retryAuthKernelNativeSessionUnlock,
} from "@/app/features/auth/services/auth-kernel-legacy-delegates";
import { isPageReloadNavigation } from "@/app/features/profiles/services/auth-public-routes";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import {
  DESKTOP_PROFILE_BOOT_RECONCILED_EVENT,
  isDesktopProfileBootReconcileComplete,
} from "@/app/features/profiles/services/desktop-window-boot";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isAuthKernelBootRestoreEnabled } from "./auth-kernel-policy";
import {
  isAuthKernelManualLockActive,
  resolveAuthKernelBootRestoreEligible,
} from "./auth-kernel-manual-lock-state";
import { authKernelProfileScopeMatches } from "./auth-kernel-profile-scope";
import { createAuthKernelRuntimeSessionPort } from "./auth-kernel-runtime-session-adapter";

export const AUTH_KERNEL_BOOT_RESTORE_MAX_ATTEMPTS = 5;
export const AUTH_KERNEL_BOOT_RESTORE_RETRY_DELAY_MS = 350;

let bootRestoreAttemptsUsed = 0;
let bootRestoreInFlight: Promise<boolean> | null = null;
let bootRestoreSettled = (
  typeof window === "undefined"
  || !hasNativeRuntime()
  || !isPageReloadNavigation()
);

/** False on desktop F5 until auth-kernel boot restore finishes — gates auth shell. */
export const isAuthKernelBootRestoreSettled = (): boolean => bootRestoreSettled;

export const markAuthKernelBootRestoreSettled = (): void => {
  bootRestoreSettled = true;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const waitForProfileBootReconcile = async (timeoutMs: number): Promise<void> => {
  if (isDesktopProfileBootReconcileComplete()) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timerId = window.setTimeout(resolve, timeoutMs);
    const onReconciled = (): void => {
      window.clearTimeout(timerId);
      window.removeEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onReconciled);
      resolve();
    };
    window.addEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onReconciled);
  });
};

const ensureNativeWindowProfileBinding = async (profileId: string): Promise<void> => {
  const trimmedProfileId = profileId.trim();
  if (!trimmedProfileId) {
    return;
  }
  const snapshot = desktopProfileRuntime.getSnapshot();
  if (snapshot.currentWindow.profileId === trimmedProfileId) {
    return;
  }
  await desktopProfileRuntime.bindCurrentWindowProfile(trimmedProfileId);
};

/**
 * Bounded auth-kernel boot restore — single owner for F5 and post-profile-reconcile cold paths.
 */
export const runAuthKernelBootRestore = async (
  options?: Readonly<{ skipBootWait?: boolean }>,
): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }

  const profileId = resolveIdentityScopeProfileId();
  if (!isAuthKernelBootRestoreEnabled(profileId)) {
    markAuthKernelBootRestoreSettled();
    return false;
  }

  if (bootRestoreInFlight) {
    return bootRestoreInFlight;
  }

  bootRestoreInFlight = (async (): Promise<boolean> => {
    if (getIdentitySnapshot().status === "unlocked") {
      return true;
    }

    if (!options?.skipBootWait) {
      await waitForProfileBootReconcile(8_000);
    }

    const runtimeSession = createAuthKernelRuntimeSessionPort();

    while (bootRestoreAttemptsUsed < AUTH_KERNEL_BOOT_RESTORE_MAX_ATTEMPTS) {
      bootRestoreAttemptsUsed += 1;

      if (getIdentitySnapshot().status === "unlocked") {
        return true;
      }

      const activeProfileId = resolveIdentityScopeProfileId();
      try {
        await ensureNativeWindowProfileBinding(activeProfileId);
        await desktopProfileRuntime.refresh();
      } catch {
        // Best-effort bind/refresh before restore probes.
      }

      await rehydrateAuthKernelIdentityForActiveProfile();
      const storedPublicKeyHex = getIdentitySnapshot().stored?.publicKeyHex;
      if (!storedPublicKeyHex) {
        if (bootRestoreAttemptsUsed < AUTH_KERNEL_BOOT_RESTORE_MAX_ATTEMPTS) {
          await sleep(AUTH_KERNEL_BOOT_RESTORE_RETRY_DELAY_MS);
        }
        continue;
      }

      const manualLockActive = isAuthKernelManualLockActive(activeProfileId);
      const restoreEligible = resolveAuthKernelBootRestoreEligible(activeProfileId);
      const bootSnapshot = await runtimeSession.readBootSnapshot({
        profileId: activeProfileId,
        expectedPublicKeyHex: storedPublicKeyHex,
        restoreEligible,
      });
      if (bootSnapshot.status === "failed") {
        if (bootRestoreAttemptsUsed < AUTH_KERNEL_BOOT_RESTORE_MAX_ATTEMPTS) {
          await sleep(AUTH_KERNEL_BOOT_RESTORE_RETRY_DELAY_MS);
        }
        continue;
      }

      if (bootSnapshot.value?.phase === "mismatch") {
        logAppEvent({
          name: "auth.kernel_boot_restore_mismatch",
          level: "warn",
          scope: { feature: "auth", action: "auth_kernel_boot" },
          context: { profileId: activeProfileId },
        });
        return false;
      }

      if (
        bootSnapshot.value?.profileId
        && !authKernelProfileScopeMatches(activeProfileId, bootSnapshot.value.profileId)
      ) {
        logAppEvent({
          name: "auth.kernel_boot_restore_profile_scope_violation",
          level: "warn",
          scope: { feature: "auth", action: "auth_kernel_boot" },
          context: {
            activeProfileId,
            snapshotProfileId: bootSnapshot.value.profileId,
          },
        });
        return false;
      }

      if (!bootSnapshot.value?.keychainPresent) {
        logAppEvent({
          name: "auth.kernel_boot_restore_no_keychain",
          level: "info",
          scope: { feature: "auth", action: "auth_kernel_boot" },
          context: { profileId: activeProfileId },
        });
        return false;
      }

      if (manualLockActive) {
        logAppEvent({
          name: "auth.kernel_boot_restore_manual_lock",
          level: "info",
          scope: { feature: "auth", action: "auth_kernel_boot" },
          context: {
            profileId: activeProfileId,
            keychainPresent: bootSnapshot.value?.keychainPresent ?? false,
          },
        });
        return false;
      }

      const unlocked = await retryAuthKernelNativeSessionUnlock();
      if (unlocked) {
        reconcileWindowRuntimeBinding();
        logAppEvent({
          name: "auth.kernel_boot_restore_succeeded",
          level: "info",
          scope: { feature: "auth", action: "auth_kernel_boot" },
          context: { profileId: activeProfileId, attempt: bootRestoreAttemptsUsed },
        });
        return true;
      }

      if (bootRestoreAttemptsUsed < AUTH_KERNEL_BOOT_RESTORE_MAX_ATTEMPTS) {
        await sleep(AUTH_KERNEL_BOOT_RESTORE_RETRY_DELAY_MS);
      }
    }

    logAppEvent({
      name: "auth.kernel_boot_restore_exhausted",
      level: "warn",
      scope: { feature: "auth", action: "auth_kernel_boot" },
      context: {
        profileId,
        attempts: bootRestoreAttemptsUsed,
      },
    });
    return false;
  })().finally(() => {
    bootRestoreInFlight = null;
    markAuthKernelBootRestoreSettled();
  });

  return bootRestoreInFlight;
};

export const resetAuthKernelBootRestoreStateForTests = (): void => {
  bootRestoreAttemptsUsed = 0;
  bootRestoreInFlight = null;
  bootRestoreSettled = true;
};

export const waitForAuthKernelBootRestore = async (timeoutMs = 8_000): Promise<boolean> => {
  if (bootRestoreSettled) {
    return getIdentitySnapshot().status === "unlocked";
  }
  if (bootRestoreInFlight) {
    await bootRestoreInFlight;
    return getIdentitySnapshot().status === "unlocked";
  }
  await waitForProfileBootReconcile(timeoutMs);
  if (bootRestoreInFlight) {
    await bootRestoreInFlight;
  }
  return getIdentitySnapshot().status === "unlocked";
};
