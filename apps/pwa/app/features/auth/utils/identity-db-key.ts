import { getProfileIdentityDbKey } from "@/app/features/profiles/services/profile-scope";

export const legacyIdentityDbKey: string = "primary";

export const getIdentityDbKey = (): string => {
  return getProfileIdentityDbKey();
};
