export const ENCRYPTED_WORKSPACE_BUNDLE_FORMAT = "obscur.encrypted_workspace_bundle.v1" as const;

export type EncryptedWorkspaceBundlePayload = Readonly<{
  version: 1;
  exportedAtUnixMs: number;
  profileId: string;
  profileLabel?: string;
  publicKeyHex: string;
  includesVaultMedia: boolean;
  workspaceArchive: unknown;
  networkSnapshot: Readonly<{
    chatStateKeys: ReadonlyArray<string>;
    chatStateJson: string | null;
    membershipLedgerJson: string | null;
    blocklistJson: string | null;
    contactOutboxJson: string | null;
  }>;
  settingsSnapshot: Readonly<{
    themePreference: string | null;
    privacySettingsJson: string | null;
    uiSettingsJson: string | null;
    localMediaConfigJson: string | null;
  }>;
  vaultMediaFiles?: ReadonlyArray<Readonly<{
    relativePath: string;
    fileName: string;
    contentType: string;
    size: number;
    contentBase64: string;
  }>>;
}>;

export type EncryptedWorkspaceBundleEnvelope = Readonly<{
  version: 1;
  format: typeof ENCRYPTED_WORKSPACE_BUNDLE_FORMAT;
  profileId: string;
  publicKeyHex: string;
  exportedAtUnixMs: number;
  compression: "gzip+base64";
  ciphertext: string;
}>;

export type EncryptedWorkspaceBundleExportOptions = Readonly<{
  profileId: string;
  profileLabel?: string;
  publicKeyHex: string;
  privateKeyHex: string;
  includeVaultMedia?: boolean;
  maxVaultFileBytes?: number;
  maxVaultTotalBytes?: number;
  fileName?: string;
}>;
