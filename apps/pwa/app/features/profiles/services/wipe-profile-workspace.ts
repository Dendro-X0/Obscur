import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  resetLocalHistoryKeepingIdentity,
  type LocalHistoryResetReport,
} from "@/app/features/messaging/services/local-history-reset-service";
import { clearProfileLocalData } from "./profile-data-cleanup";

export type ProfileWorkspaceWipeReport = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | null;
  historyReset: LocalHistoryResetReport;
}>;

/** Clears all local workspace data for a profile slot (history, sync, identity, scoped keys). */
export const wipeProfileWorkspaceCompletely = async (params: Readonly<{
  profileId: string;
  publicKeyHex?: PublicKeyHex | null;
}>): Promise<ProfileWorkspaceWipeReport> => {
  const historyReset = await resetLocalHistoryKeepingIdentity({
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex ?? null,
  });
  await clearProfileLocalData(params.profileId);
  return {
    profileId: params.profileId,
    publicKeyHex: historyReset.publicKeyHex,
    historyReset,
  };
};
