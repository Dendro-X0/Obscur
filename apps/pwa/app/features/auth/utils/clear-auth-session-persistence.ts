import { clearDeviceTrustArtifacts } from "@/app/features/auth/services/device-trust-service";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type ClearAuthSessionPersistenceParams = Readonly<{
  profileId?: string;
  includeLegacy?: boolean;
}>;

export const clearAuthSessionPersistence = (params?: ClearAuthSessionPersistenceParams): void => {
  clearDeviceTrustArtifacts({
    profileId: params?.profileId?.trim() || getResolvedProfileId(),
    includeLegacy: params?.includeLegacy,
  });
};
