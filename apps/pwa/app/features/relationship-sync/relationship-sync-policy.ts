import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";

const parseEnvFlag = (raw: string | undefined): boolean => (
  (raw ?? "").trim() === "1" || (raw ?? "").trim().toLowerCase() === "true"
);

const parseEnvDisabled = (raw: string | undefined): boolean => (
  (raw ?? "").trim() === "0" || (raw ?? "").trim().toLowerCase() === "false"
);

/** Directory-backed membership repair is on by default for native workspace kernel builds. */
export const isRelationshipSyncExperimentEnabled = (): boolean => {
  if (parseEnvDisabled(process.env.NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT)) {
    return false;
  }
  if (parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT)) {
    return true;
  }
  return isWorkspaceKernelAuthority();
};
