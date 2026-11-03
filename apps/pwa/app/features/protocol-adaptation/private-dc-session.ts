import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

/**
 * P4 — private DC / company-server session (profile-scoped).
 * @see specs/backend/platform-p4-second-carrier-design-2026-11.md
 */
export type PrivateDcSession = Readonly<{
  baseUrl: string;
  bearerToken?: string;
  displayName?: string;
}>;

const STORAGE_KEY = "obscur.private_dc_session.v1";

export const getPrivateDcSessionStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

export const readPrivateDcSession = (profileId?: string): PrivateDcSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getPrivateDcSessionStorageKey(profileId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PrivateDcSession>;
    if (typeof parsed.baseUrl !== "string" || parsed.baseUrl.trim().length === 0) {
      return null;
    }
    const baseUrl = parsed.baseUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(baseUrl)) {
      return null;
    }
    return {
      baseUrl,
      bearerToken: typeof parsed.bearerToken === "string" && parsed.bearerToken.trim()
        ? parsed.bearerToken.trim()
        : undefined,
      displayName: typeof parsed.displayName === "string" && parsed.displayName.trim()
        ? parsed.displayName.trim()
        : undefined,
    };
  } catch {
    return null;
  }
};

export const writePrivateDcSession = (
  session: PrivateDcSession,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const baseUrl = session.baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("PrivateDcSession: baseUrl must be http(s)");
  }
  window.localStorage.setItem(
    getPrivateDcSessionStorageKey(profileId),
    JSON.stringify({
      baseUrl,
      bearerToken: session.bearerToken?.trim() || undefined,
      displayName: session.displayName?.trim() || undefined,
    }),
  );
};

export const clearPrivateDcSession = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getPrivateDcSessionStorageKey(profileId));
};

export const hasPrivateDcSession = (profileId?: string): boolean => (
  readPrivateDcSession(profileId) !== null
);
