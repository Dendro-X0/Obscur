/**
 * Preferred Create Group tier after Operator "Save & use for new teams" (CU-UX-1).
 */

export type PreferredGroupCreateTier = "quick" | "team";

const STORAGE_KEY = "obscur.preferred_group_create_tier.v1";

export const readPreferredGroupCreateTier = (): PreferredGroupCreateTier | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "quick" || raw === "team") {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
};

export const writePreferredGroupCreateTier = (tier: PreferredGroupCreateTier | null): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!tier) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // ignore
  }
};
