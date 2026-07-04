import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getProfileStorageKeyMaterial } from "@/app/features/storage/services/profile-storage-key-session";
import {
  encryptStorageEnvelopeV1,
  serializeStorageEnvelopeV1,
} from "@/app/features/storage/services/storage-envelope-v1";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  PROFILE_WORKSPACE_ARCHIVE_FORMAT,
  type ProfileWorkspaceArchive,
  type ProfileWorkspaceArchiveReason,
  type ProfileWorkspaceArchiveWriteResult,
  type ProfileWorkspaceStorageEntry,
} from "./profile-workspace-archive-contracts";
import { getScopedStorageKey } from "./profile-scope";
import { getLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";

const SCOPED_SUFFIX_PREFIX = "::";

const collectScopedEntries = (storage: Storage, profileId: string): ReadonlyArray<ProfileWorkspaceStorageEntry> => {
  const suffix = `${SCOPED_SUFFIX_PREFIX}${profileId}`;
  const entries: ProfileWorkspaceStorageEntry[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.endsWith(suffix)) {
      continue;
    }
    const value = storage.getItem(key);
    if (value !== null) {
      entries.push({ key, value });
    }
  }
  return entries;
};

export const buildProfileWorkspaceArchive = (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  reason: ProfileWorkspaceArchiveReason;
  lastBoundPublicKeyHex?: PublicKeyHex | null;
}>): ProfileWorkspaceArchive | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const profileId = params.profileId.trim();
  if (profileId.length === 0) {
    return null;
  }
  const lastBoundPublicKeyHex = params.lastBoundPublicKeyHex
    ?? getLastBoundAccountPublicKeyHex(profileId);

  return {
    version: 1,
    format: PROFILE_WORKSPACE_ARCHIVE_FORMAT,
    profileId,
    profileLabel: params.profileLabel?.trim() || undefined,
    exportedAtUnixMs: Date.now(),
    reason: params.reason,
    lastBoundPublicKeyHex: lastBoundPublicKeyHex ?? undefined,
    localStorageEntries: collectScopedEntries(window.localStorage, profileId),
    sessionStorageEntries: collectScopedEntries(window.sessionStorage, profileId),
  };
};

const sanitizeFileNameSegment = (value: string): string => (
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "profile"
);

export const buildProfileWorkspaceArchiveFileName = (
  archive: ProfileWorkspaceArchive,
  encrypted = false,
): string => {
  const stamp = new Date(archive.exportedAtUnixMs).toISOString().replace(/[:.]/g, "-");
  const profileSegment = sanitizeFileNameSegment(archive.profileId);
  const reasonSegment = sanitizeFileNameSegment(archive.reason);
  const suffix = encrypted ? ".obscur-profile.enc.json" : ".obscur-profile.json";
  return `${profileSegment}__${reasonSegment}__${stamp}${suffix}`;
};

const triggerBrowserDownload = (fileName: string, contents: string): void => {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
};

export const writeProfileWorkspaceArchive = async (
  archive: ProfileWorkspaceArchive,
): Promise<ProfileWorkspaceArchiveWriteResult> => {
  const keyMaterial = getProfileStorageKeyMaterial(archive.profileId);
  const encrypted = Boolean(keyMaterial && hasNativeRuntime());
  const fileName = buildProfileWorkspaceArchiveFileName(archive, encrypted);
  let contents = JSON.stringify(archive, null, 2);
  if (encrypted && keyMaterial) {
    const envelope = await encryptStorageEnvelopeV1({
      plaintext: new TextEncoder().encode(contents),
      keyMaterial,
      purpose: "profile-archive",
      profileId: archive.profileId,
    });
    contents = serializeStorageEnvelopeV1(envelope);
  }

  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<string>("desktop_write_profile_workspace_archive", {
      fileName,
      contents,
    });
    if (result.ok) {
      logAppEvent({
        name: "profiles.workspace_archive_written",
        level: "info",
        scope: { feature: "profiles", action: "workspace_archive" },
        context: {
          profileId: archive.profileId,
          reason: archive.reason,
          fileName,
          absolutePath: result.value,
        },
      });
      return {
        fileName,
        absolutePath: result.value,
        downloadTriggered: false,
      };
    }
  }

  triggerBrowserDownload(fileName, contents);
  logAppEvent({
    name: "profiles.workspace_archive_downloaded",
    level: "info",
    scope: { feature: "profiles", action: "workspace_archive" },
    context: {
      profileId: archive.profileId,
      reason: archive.reason,
      fileName,
    },
  });
  return {
    fileName,
    absolutePath: null,
    downloadTriggered: true,
  };
};

export const archiveProfileWorkspaceBeforeWipe = async (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  reason: ProfileWorkspaceArchiveReason;
  lastBoundPublicKeyHex?: PublicKeyHex | null;
}>): Promise<ProfileWorkspaceArchiveWriteResult | null> => {
  const archive = buildProfileWorkspaceArchive(params);
  if (!archive) {
    return null;
  }
  const hasData = archive.localStorageEntries.length > 0 || archive.sessionStorageEntries.length > 0;
  const forceArchive = params.reason === "profile_removed"
    || params.reason === "settings_clear_data"
    || params.reason === "settings_delete_account";
  if (!hasData && !archive.lastBoundPublicKeyHex && !forceArchive) {
    return null;
  }
  return writeProfileWorkspaceArchive(archive);
};

const isProfileWorkspaceArchive = (value: unknown): value is ProfileWorkspaceArchive => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ProfileWorkspaceArchive>;
  return candidate.version === 1
    && candidate.format === PROFILE_WORKSPACE_ARCHIVE_FORMAT
    && typeof candidate.profileId === "string"
    && typeof candidate.exportedAtUnixMs === "number"
    && Array.isArray(candidate.localStorageEntries)
    && Array.isArray(candidate.sessionStorageEntries);
};

export const parseProfileWorkspaceArchive = (raw: unknown): ProfileWorkspaceArchive | null => {
  if (typeof raw === "string") {
    try {
      return parseProfileWorkspaceArchive(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return isProfileWorkspaceArchive(raw) ? raw : null;
};

export const importProfileWorkspaceArchiveIntoScope = (
  archive: ProfileWorkspaceArchive,
  targetProfileId: string,
): Readonly<{ importedLocalKeys: number; importedSessionKeys: number }> => {
  if (typeof window === "undefined") {
    return { importedLocalKeys: 0, importedSessionKeys: 0 };
  }
  const suffix = `${SCOPED_SUFFIX_PREFIX}${archive.profileId}`;
  const targetSuffix = `${SCOPED_SUFFIX_PREFIX}${targetProfileId}`;

  const remapKey = (key: string): string => (
    key.endsWith(suffix) ? `${key.slice(0, key.length - suffix.length)}${targetSuffix}` : key
  );

  let importedLocalKeys = 0;
  let importedSessionKeys = 0;

  archive.localStorageEntries.forEach((entry) => {
    const key = remapKey(entry.key);
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, entry.value);
      importedLocalKeys += 1;
    }
  });

  archive.sessionStorageEntries.forEach((entry) => {
    const key = remapKey(entry.key);
    if (window.sessionStorage.getItem(key) === null) {
      window.sessionStorage.setItem(key, entry.value);
      importedSessionKeys += 1;
    }
  });

  if (archive.lastBoundPublicKeyHex) {
    const bindingKey = getScopedStorageKey("obscur.profile_window.last_bound_account", targetProfileId);
    if (window.localStorage.getItem(bindingKey) === null) {
      window.localStorage.setItem(bindingKey, archive.lastBoundPublicKeyHex);
    }
  }

  return { importedLocalKeys, importedSessionKeys };
};
