import { toast } from "@dweb/ui-kit";
import type { ProfileWorkspaceArchiveWriteResult } from "./profile-workspace-archive-contracts";

/** Toast-only feedback; use ProfileArchiveResultDialog to show export paths. */
export const notifyProfileWorkspaceArchiveSaved = (
  result: ProfileWorkspaceArchiveWriteResult | null,
): void => {
  if (!result) {
    return;
  }
  if (result.downloadTriggered) {
    toast.success("Profile workspace archive downloaded.");
    return;
  }
  toast.success("Profile workspace archive saved.");
};
