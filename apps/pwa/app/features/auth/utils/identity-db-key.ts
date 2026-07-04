import { getProfileIdentityDbKey } from "@/app/features/profiles/services/profile-scope";
import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";

export const legacyIdentityDbKey: string = "primary";

export const getIdentityDbKey = (): string => {
  return getProfileIdentityDbKey(resolveIdentityScopeProfileId());
};
