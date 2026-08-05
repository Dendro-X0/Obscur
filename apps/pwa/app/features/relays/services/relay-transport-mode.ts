import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type RelayTransportMode = "basic" | "redundancy";

/** Max relays connected in the active pool when redundancy mode is on. */
export const REDUNDANCY_POOL_MAX_RELAYS = 3;

const STORAGE_KEY = "obscur.relay_transport_mode.v1";

const isBasicEnvForced = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_RELAY_BASIC === "1"
);

export const getRelayTransportModeStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId())
);

export const readRelayTransportMode = (profileId?: string): RelayTransportMode => {
  if (typeof window === "undefined") {
    return isBasicEnvForced() ? "basic" : "redundancy";
  }
  try {
    const raw = window.localStorage.getItem(getRelayTransportModeStorageKey(profileId));
    if (raw === "redundancy" || raw === "basic") {
      return raw;
    }
  } catch {
    // ignore
  }
  // Prod-first 2026-08: Default Stable uses redundancy; force basic only via env.
  return isBasicEnvForced() ? "basic" : "redundancy";
};

export const writeRelayTransportMode = (
  mode: RelayTransportMode,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getRelayTransportModeStorageKey(profileId), mode);
  } catch {
    // ignore
  }
};
