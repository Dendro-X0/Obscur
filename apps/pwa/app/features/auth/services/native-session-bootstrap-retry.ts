import { getIdentitySnapshot, useIdentityInternals } from "@/app/features/auth/hooks/use-identity";
import { isDeviceSessionRestoreAllowed } from "@/app/features/auth/services/device-session-consent";
import { NATIVE_SECURE_SESSION_RESTORE_ENABLED } from "@/app/features/auth/services/session-credential-policy";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { logAppEvent } from "@/app/shared/log-app-event";

/** Retry OS keychain restore after desktop profile scope + registry reconcile. */
export const retryNativeSessionBootstrapAfterProfileReady = async (): Promise<boolean> => {
  if (!hasNativeRuntime() || !NATIVE_SECURE_SESSION_RESTORE_ENABLED) {
    return false;
  }

  const profileId = getResolvedProfileId();
  if (!isDeviceSessionRestoreAllowed(profileId)) {
    return false;
  }

  const identity = getIdentitySnapshot();
  if (identity.status === "unlocked") {
    return true;
  }
  if (!identity.stored?.publicKeyHex) {
    return false;
  }

  const unlocked = await useIdentityInternals.retryNativeSessionUnlockAction();
  if (!unlocked) {
    logAppEvent({
      name: "auth.native_secure_restore_deferred_retry_skipped",
      level: "debug",
      scope: { feature: "auth", action: "native_secure_restore" },
      context: { profileId },
    });
    return false;
  }

  reconcileWindowRuntimeBinding();
  logAppEvent({
    name: "auth.native_secure_restore_deferred_retry_succeeded",
    level: "info",
    scope: { feature: "auth", action: "native_secure_restore" },
    context: { profileId },
  });
  return true;
};
