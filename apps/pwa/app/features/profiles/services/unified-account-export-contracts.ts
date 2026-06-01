import type { PortableAccountBundle } from "@/app/features/account-sync/account-sync-contracts";
import type { EncryptedWorkspaceBundleEnvelope } from "./encrypted-workspace-bundle-contracts";

export const UNIFIED_ACCOUNT_EXPORT_FORMAT = "obscur.unified_account_export.v1" as const;

export type UnifiedAccountExportEnvelope = Readonly<{
  version: 1;
  format: typeof UNIFIED_ACCOUNT_EXPORT_FORMAT;
  exportedAtUnixMs: number;
  publicKeyHex: string;
  profileLabel?: string;
  portableAccountBundle: PortableAccountBundle;
  workspaceBundle: EncryptedWorkspaceBundleEnvelope | null;
  manifest: Readonly<{
    includesVaultMedia: boolean;
    portableEstimatedBytes: number;
    workspaceEstimatedBytes: number | null;
  }>;
}>;
