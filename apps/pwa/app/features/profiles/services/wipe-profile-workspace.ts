import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { clearProfileLocalData } from "./profile-data-cleanup";
import {
  completeProfileLocalDataRemoval,
  type ProfileLocalResetReport,
} from "./profile-local-reset-service";

export type ProfileWorkspaceWipeReport = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
  localReset: ProfileLocalResetReport;
}>;

/** Clears all local workspace data for a profile slot (history, sync, identity, scoped keys). */
export const wipeProfileWorkspaceCompletely = async (params: Readonly<{
  profileId: string;
  publicKeyHex?: PublicKeyHex | null;
}>): Promise<ProfileWorkspaceWipeReport> => {
  const localReset = await completeProfileLocalDataRemoval({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex ?? null,
  });
  await clearProfileLocalData(params.profileId);
  return {
    profileId: params.profileId,
    publicKeyHex: localReset.publicKeyHex,
    localReset,
  };
};
