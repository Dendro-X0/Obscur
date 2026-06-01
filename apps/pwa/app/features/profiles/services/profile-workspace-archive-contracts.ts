import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export const PROFILE_WORKSPACE_ARCHIVE_FORMAT = "obscur.profile_workspace_archive.v1" as const;

export type ProfileWorkspaceArchiveReason =
  | "manual_export"
  | "logout"
  | "profile_removed"
  | "account_switch"
  | "settings_clear_data"
  | "settings_delete_account";

export type ProfileWorkspaceStorageEntry = Readonly<{
  key: string;
  value: string;
}>;

/** Local profile-window snapshot (workspace slot), not a network account bundle. */
export type ProfileWorkspaceArchive = Readonly<{
  version: 1;
  format: typeof PROFILE_WORKSPACE_ARCHIVE_FORMAT;
  profileId: string;
  profileLabel?: string;
  exportedAtUnixMs: number;
  reason: ProfileWorkspaceArchiveReason;
  lastBoundPublicKeyHex?: PublicKeyHex;
  localStorageEntries: ReadonlyArray<ProfileWorkspaceStorageEntry>;
  sessionStorageEntries: ReadonlyArray<ProfileWorkspaceStorageEntry>;
}>;

export type ProfileWorkspaceArchiveWriteResult = Readonly<{
  fileName: string;
  absolutePath: string | null;
  downloadTriggered: boolean;
}>;
