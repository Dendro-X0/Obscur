import type { PortabilityImportPreflight } from "./portability-import-preflight";
import type { PendingProfileImport } from "./pending-profile-import-service";

/** Staged restore flow: user already confirmed on restore; apply once unlock matches. */
export const shouldAutoApplyStagedImportOnUnlock = (params: Readonly<{
  pending: PendingProfileImport | null;
  activePublicKeyHex: string | null;
  preflight: PortabilityImportPreflight | null;
  autoResumeOnUnlock: boolean;
}>): boolean => {
  if (!params.autoResumeOnUnlock || !params.pending || !params.activePublicKeyHex || !params.preflight) {
    return false;
  }
  if (!params.preflight.canProceed) {
    return false;
  }
  return params.pending.bundlePublicKeyHex.trim().toLowerCase()
    === params.activePublicKeyHex.trim().toLowerCase();
};
