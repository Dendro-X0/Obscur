import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { getDefaultProfileId } from "./profile-scope";
import { ProfileRegistryService } from "./profile-registry-service";
import { listProfileIdsWithBoundAccountPublicKeyHex } from "./profile-window-account-binding";

const normalizePublicKeyHex = (value: string | null | undefined): PublicKeyHex | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

/**
 * Desktop DM sqlite rows are profile-slot scoped at write time. The same account may be
 * active in multiple windows (e.g. `default` + a secondary profile slot), and historical
 * rows may have been written under the wrong slot before scope was corrected. Hydrate
 * therefore scans every registered local profile slot; callers must filter merged rows to
 * the active account (see dm-conversation-hydrate-indexed-scan).
 */
export const listAccountSharedSqliteProfileIds = (params: Readonly<{
  primaryProfileId: string;
  accountPublicKeyHex: PublicKeyHex | string | null | undefined;
}>): ReadonlyArray<string> => {
  const primaryProfileId = params.primaryProfileId.trim() || getDefaultProfileId();
  if (!requiresSqlitePersistence()) {
    return [primaryProfileId];
  }

  const accountPublicKeyHex = normalizePublicKeyHex(params.accountPublicKeyHex);
  if (!accountPublicKeyHex) {
    return [primaryProfileId];
  }

  const profileIds = new Set<string>([
    primaryProfileId,
    getDefaultProfileId(),
  ]);

  ProfileRegistryService.getState().profiles.forEach((profile) => {
    profileIds.add(profile.profileId);
  });

  listProfileIdsWithBoundAccountPublicKeyHex(accountPublicKeyHex).forEach((profileId) => {
    profileIds.add(profileId);
  });

  return Array.from(profileIds);
};
