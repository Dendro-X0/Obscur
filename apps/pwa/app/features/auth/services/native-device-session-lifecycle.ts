import { cryptoService } from "@/app/features/crypto/crypto-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";

export const NATIVE_SESSION_LOCKED_EVENT = "auth.native_session_locked";
export const NATIVE_DEVICE_SIGN_IN_ENDED_EVENT = "auth.native_device_sign_in_ended";

type NativeSessionLifecycleApi = Readonly<{
  clearNativeSession?: () => Promise<void>;
  deleteNativeKey?: () => Promise<void>;
}>;

const getNativeSessionApi = (): NativeSessionLifecycleApi => (
  cryptoService as unknown as NativeSessionLifecycleApi
);

const hasAsyncFn = (value: unknown): value is () => Promise<void> => typeof value === "function";

/**
 * Lock path — `clear_native_session` only. Keeps OS keychain for restart restore.
 */
export const clearInMemoryNativeSessionBestEffort = async (): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const api = getNativeSessionApi();
  if (!hasAsyncFn(api.clearNativeSession)) {
    return;
  }
  try {
    await api.clearNativeSession();
    logAppEvent({
      name: NATIVE_SESSION_LOCKED_EVENT,
      level: "info",
      scope: { feature: "auth", action: "native_session_lock" },
      context: { keychainPreserved: true },
    });
  } catch (error) {
    logAppEvent({
      name: "auth.native_session_lock_failed",
      level: "warn",
      scope: { feature: "auth", action: "native_session_lock" },
      context: {
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    console.warn("[Identity] Failed to clear in-memory native session:", error);
  }
};

/**
 * Sign-out path — `logout_native` (delete keychain + clear in-memory session).
 */
export const endNativeDeviceSignInBestEffort = async (): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const api = getNativeSessionApi();
  if (!hasAsyncFn(api.deleteNativeKey)) {
    return;
  }
  try {
    await api.deleteNativeKey();
    logAppEvent({
      name: NATIVE_DEVICE_SIGN_IN_ENDED_EVENT,
      level: "info",
      scope: { feature: "auth", action: "native_device_sign_out" },
      context: { keychainDeleted: true },
    });
  } catch (error) {
    logAppEvent({
      name: "auth.native_device_sign_in_end_failed",
      level: "warn",
      scope: { feature: "auth", action: "native_device_sign_out" },
      context: {
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    console.warn("[Identity] Failed to end native device sign-in:", error);
  }
};
