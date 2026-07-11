import { getProfileSlotOccupantPublicKeyHex } from "./profile-slot-login-guard";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

/**
 * Clears orphan SQLite/chat state in a profile window slot that has no bound account.
 * Greenfield create/import must not inherit groups or contacts from prior slot use.
 */
export const clearOrphanProfileSlotWorkspace = async (profileId: string): Promise<void> => {
  const trimmed = profileId.trim();
  if (!trimmed || getProfileSlotOccupantPublicKeyHex(trimmed)) {
    return;
  }
  await wipeProfileWorkspaceCompletely({
    profileId: trimmed,
    publicKeyHex: null,
  });
};
