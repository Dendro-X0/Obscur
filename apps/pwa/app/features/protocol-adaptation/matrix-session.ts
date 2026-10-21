import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type MatrixSession = Readonly<{
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId?: string;
}>;

const STORAGE_KEY = "obscur.matrix_session.v1";

export const getMatrixSessionStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

export const readMatrixSession = (profileId?: string): MatrixSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getMatrixSessionStorageKey(profileId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<MatrixSession>;
    if (
      typeof parsed.homeserverUrl !== "string"
      || typeof parsed.userId !== "string"
      || typeof parsed.accessToken !== "string"
      || parsed.homeserverUrl.trim().length === 0
      || parsed.userId.trim().length === 0
      || parsed.accessToken.trim().length === 0
    ) {
      return null;
    }
    return {
      homeserverUrl: parsed.homeserverUrl.trim().replace(/\/+$/, ""),
      userId: parsed.userId.trim(),
      accessToken: parsed.accessToken.trim(),
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : undefined,
    };
  } catch {
    return null;
  }
};

export const writeMatrixSession = (
  session: MatrixSession,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getMatrixSessionStorageKey(profileId),
      JSON.stringify({
        homeserverUrl: session.homeserverUrl.trim().replace(/\/+$/, ""),
        userId: session.userId.trim(),
        accessToken: session.accessToken.trim(),
        deviceId: session.deviceId,
      }),
    );
  } catch {
    // ignore
  }
};

export const clearMatrixSession = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(getMatrixSessionStorageKey(profileId));
  } catch {
    // ignore
  }
};

export const hasMatrixSession = (profileId?: string): boolean => (
  readMatrixSession(profileId) != null
);
