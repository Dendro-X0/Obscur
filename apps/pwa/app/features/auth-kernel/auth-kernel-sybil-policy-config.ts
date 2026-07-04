import type { AuthSybilPolicySnapshot, AuthSybilTier } from "@dweb/auth";
import { DEFAULT_AUTH_SYBIL_POLICY, resolveAuthSybilPolicyForTier } from "@dweb/auth";

const SYBIL_TIER_OVERRIDE_STORAGE_KEY = "obscur.auth.sybil_tier_override";

const SYBIL_TIERS: ReadonlyArray<AuthSybilTier> = ["A", "B", "C", "D"];

const normalizeSybilTier = (value: string | undefined | null): AuthSybilTier | null => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || !SYBIL_TIERS.includes(normalized as AuthSybilTier)) {
    return null;
  }
  return normalized as AuthSybilTier;
};

/** Steward / dev-lab override — localStorage wins over build-time env. */
export const readAuthKernelSybilTierOverride = (): AuthSybilTier | null => {
  if (typeof window !== "undefined") {
    const stored = normalizeSybilTier(localStorage.getItem(SYBIL_TIER_OVERRIDE_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  }
  return normalizeSybilTier(process.env.NEXT_PUBLIC_OBSCUR_AUTH_SYBIL_TIER);
};

export const writeAuthKernelSybilTierOverride = (tier: AuthSybilTier | null): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (!tier) {
    localStorage.removeItem(SYBIL_TIER_OVERRIDE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SYBIL_TIER_OVERRIDE_STORAGE_KEY, tier);
};

/** Canonical Plane B policy source for this deployment (steward-configurable). */
export const resolveAuthKernelSybilPolicy = (_profileId: string): AuthSybilPolicySnapshot => {
  const tier = readAuthKernelSybilTierOverride() ?? DEFAULT_AUTH_SYBIL_POLICY.tier;
  return resolveAuthSybilPolicyForTier(tier);
};
