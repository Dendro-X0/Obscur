import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  buildDevLabAuthScopeFingerprint,
  compareDevLabMembershipScopeSnapshots,
  probeDevLabMembershipScope,
  type DevLabMembershipScopeSnapshot,
} from "./dev-lab-membership-scope-probe";

export type DevLabAuth4ScopeProbeResult = Readonly<{
  ok: boolean;
  issues: ReadonlyArray<string>;
  profileA: DevLabMembershipScopeSnapshot;
  profileB: DevLabMembershipScopeSnapshot;
  profileAFingerprint: string;
  profileBFingerprint: string;
  profileAAfterReload: DevLabMembershipScopeSnapshot | null;
  profileAFingerprintAfterReload: string | null;
}>;

/**
 * AUTH-4 synthetic — dual-profile scope isolation without cross-profile bleed.
 * Call twice with distinct profile/pubkey pairs (CLI dual browser or sequential unlock).
 */
export const evaluateDevLabAuth4ScopeProbe = (params: Readonly<{
  profileA: Readonly<{ publicKeyHex: PublicKeyHex | string; profileId?: string }>;
  profileB: Readonly<{ publicKeyHex: PublicKeyHex | string; profileId?: string }>;
  profileAAfterReload?: Readonly<{ publicKeyHex: PublicKeyHex | string; profileId?: string }> | null;
}>): DevLabAuth4ScopeProbeResult => {
  const profileA = probeDevLabMembershipScope(params.profileA);
  const profileB = probeDevLabMembershipScope(params.profileB);
  const profileAFingerprint = buildDevLabAuthScopeFingerprint(profileA);
  const profileBFingerprint = buildDevLabAuthScopeFingerprint(profileB);

  const issues: string[] = [];

  if (!profileA.publicKeyHex || !profileB.publicKeyHex) {
    issues.push("missing_public_key");
  }
  if (profileA.publicKeyHex && profileB.publicKeyHex && profileA.publicKeyHex === profileB.publicKeyHex) {
    issues.push("profiles_share_public_key");
  }
  if (
    profileA.profileId
    && profileB.profileId
    && profileA.profileId === profileB.profileId
    && profileA.publicKeyHex === profileB.publicKeyHex
  ) {
    issues.push("profiles_share_identity");
  }

  const aKeys = new Set(profileA.managedGroupScopes.map((entry) => `${entry.groupId}::${entry.relayUrl}`));
  const bKeys = new Set(profileB.managedGroupScopes.map((entry) => `${entry.groupId}::${entry.relayUrl}`));
  if (aKeys.size > 0 && bKeys.size > 0) {
    const overlap = [...aKeys].filter((key) => bKeys.has(key));
    if (overlap.length === aKeys.size && overlap.length === bKeys.size && profileA.publicKeyHex !== profileB.publicKeyHex) {
      issues.push("managed_group_scopes_fully_overlap");
    }
  }

  let profileAAfterReload: DevLabMembershipScopeSnapshot | null = null;
  let profileAFingerprintAfterReload: string | null = null;
  if (params.profileAAfterReload) {
    profileAAfterReload = probeDevLabMembershipScope(params.profileAAfterReload);
    profileAFingerprintAfterReload = buildDevLabAuthScopeFingerprint(profileAAfterReload);
    if (profileAFingerprint !== profileAFingerprintAfterReload) {
      issues.push("profile_a_fingerprint_changed_after_reload");
      const reloadStable = compareDevLabMembershipScopeSnapshots(profileA, profileAAfterReload);
      issues.push(...reloadStable.issues.map((issue) => `reload_${issue}`));
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    profileA,
    profileB,
    profileAFingerprint,
    profileBFingerprint,
    profileAAfterReload,
    profileAFingerprintAfterReload,
  };
};
