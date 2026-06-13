import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";

export const NATIVE_SESSION_PERSIST_FAILED_EVENT = "auth.native_session_persist_failed";
export const NATIVE_SESSION_PERSIST_SUCCEEDED_EVENT = "auth.native_session_persist_succeeded";

const PERSIST_ERROR_STORAGE_PREFIX = "obscur_native_session_persist_error::";

const persistErrorStorageKey = (profileId: string): string => (
  `${PERSIST_ERROR_STORAGE_PREFIX}${profileId}`
);

export type NativeSessionPersistErrorSnapshot = Readonly<{
  message: string;
  context: string;
  atUnixMs: number;
}>;

export const readLastNativeSessionPersistError = (
  profileId?: string,
): NativeSessionPersistErrorSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const resolvedProfileId = profileId?.trim() || getResolvedProfileId();
  const raw = window.sessionStorage.getItem(persistErrorStorageKey(resolvedProfileId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as NativeSessionPersistErrorSnapshot;
    if (
      typeof parsed.message !== "string"
      || typeof parsed.context !== "string"
      || typeof parsed.atUnixMs !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearNativeSessionPersistError = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  const resolvedProfileId = profileId?.trim() || getResolvedProfileId();
  window.sessionStorage.removeItem(persistErrorStorageKey(resolvedProfileId));
};

const writeNativeSessionPersistError = (params: Readonly<{
  profileId: string;
  context: string;
  message: string;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const snapshot: NativeSessionPersistErrorSnapshot = {
    message: params.message,
    context: params.context,
    atUnixMs: Date.now(),
  };
  window.sessionStorage.setItem(
    persistErrorStorageKey(params.profileId),
    JSON.stringify(snapshot),
  );
};

const resolveErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

export const reportNativeSessionPersistFailure = (params: Readonly<{
  profileId?: string;
  context: string;
  error: unknown;
}>): void => {
  const profileId = params.profileId?.trim() || getResolvedProfileId();
  const message = resolveErrorMessage(params.error);

  writeNativeSessionPersistError({
    profileId,
    context: params.context,
    message,
  });

  logAppEvent({
    name: NATIVE_SESSION_PERSIST_FAILED_EVENT,
    level: "error",
    scope: { feature: "auth", action: "native_session_persist" },
    context: {
      profileId,
      context: params.context,
      reason: message,
    },
  });

  console.error(`[Identity] Native session persist failed during ${params.context}:`, params.error);

  if (typeof window !== "undefined") {
    void import("@dweb/ui-kit").then(({ toast }) => {
      toast.error(
        "Could not save your session to OS secure storage. You may need to sign in again after restart.",
        { duration: 8000 },
      );
    }).catch(() => {
      // Toast provider unavailable — log-only path is sufficient.
    });
  }
};

export const reportNativeSessionPersistSuccess = (params: Readonly<{
  profileId?: string;
  context: string;
}>): void => {
  const profileId = params.profileId?.trim() || getResolvedProfileId();
  clearNativeSessionPersistError(profileId);

  logAppEvent({
    name: NATIVE_SESSION_PERSIST_SUCCEEDED_EVENT,
    level: "info",
    scope: { feature: "auth", action: "native_session_persist" },
    context: {
      profileId,
      context: params.context,
    },
  });
};
