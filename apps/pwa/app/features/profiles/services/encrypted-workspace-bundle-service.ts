import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { writeExportToDataRoot } from "@/app/features/profiles/services/data-root-export-service";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { loadThemePreference } from "@/app/features/settings/services/ui-preferences-persistence";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { loadCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { loadPersistedChatState, savePersistedChatState } from "@/app/features/messaging/utils/persistence";
import { replaceCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import {
  getLocalMediaIndexSnapshot,
  getLocalMediaStorageConfig,
  getLocalMediaStorageAbsolutePath,
} from "@/app/features/vault/services/local-media-store";
import { nativeLocalMediaAdapter } from "@/app/features/vault/services/native-local-media-adapter";
import { buildProfileWorkspaceArchive } from "./profile-workspace-archive-service";
import {
  ENCRYPTED_WORKSPACE_BUNDLE_FORMAT,
  type EncryptedWorkspaceBundleEnvelope,
  type EncryptedWorkspaceBundleExportOptions,
  type EncryptedWorkspaceBundlePayload,
} from "./encrypted-workspace-bundle-contracts";
import { logAppEvent } from "@/app/shared/log-app-event";

const DEFAULT_MAX_VAULT_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_VAULT_TOTAL_BYTES = 100 * 1024 * 1024;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const compressText = async (input: string): Promise<string> => {
  if (typeof CompressionStream === "undefined") {
    return bytesToBase64(new TextEncoder().encode(input));
  }
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64(compressed);
};

const decompressText = async (encoded: string, compression: EncryptedWorkspaceBundleEnvelope["compression"]): Promise<string> => {
  const bytes = base64ToBytes(encoded);
  if (compression !== "gzip+base64" || typeof DecompressionStream === "undefined") {
    return new TextDecoder().decode(bytes);
  }
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
};

const readScopedStorageValue = (baseKey: string, profileId: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(getScopedStorageKey(baseKey, profileId));
};

const collectVaultMediaFiles = async (params: Readonly<{
  includeVaultMedia: boolean;
  maxVaultFileBytes: number;
  maxVaultTotalBytes: number;
}>): Promise<EncryptedWorkspaceBundlePayload["vaultMediaFiles"]> => {
  if (!params.includeVaultMedia || !hasNativeRuntime()) {
    return undefined;
  }
  const storageRoot = await getLocalMediaStorageAbsolutePath();
  if (!storageRoot) {
    return undefined;
  }
  const index = getLocalMediaIndexSnapshot();
  const files: Array<{
    relativePath: string;
    fileName: string;
    contentType: string;
    size: number;
    contentBase64: string;
  }> = [];
  let totalBytes = 0;
  for (const entry of Object.values(index)) {
    if (entry.size > params.maxVaultFileBytes) {
      continue;
    }
    if (totalBytes + entry.size > params.maxVaultTotalBytes) {
      break;
    }
    try {
      const absolutePath = await nativeLocalMediaAdapter.joinPaths(storageRoot, entry.relativePath);
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(absolutePath);
      totalBytes += bytes.byteLength;
      files.push({
        relativePath: entry.relativePath,
        fileName: entry.fileName,
        contentType: entry.contentType,
        size: bytes.byteLength,
        contentBase64: bytesToBase64(bytes),
      });
    } catch {
      // Skip unreadable vault files.
    }
  }
  return files.length > 0 ? files : undefined;
};

export const buildEncryptedWorkspaceBundlePayload = async (
  params: EncryptedWorkspaceBundleExportOptions,
): Promise<EncryptedWorkspaceBundlePayload> => {
  const profileId = params.profileId.trim() || getResolvedProfileId();
  const publicKeyHex = params.publicKeyHex.trim().toLowerCase() as PublicKeyHex;
  const chatState = loadPersistedChatState(publicKeyHex, { profileId });
  const workspaceArchive = buildProfileWorkspaceArchive({
    profileId,
    profileLabel: params.profileLabel,
    reason: "manual_export",
    lastBoundPublicKeyHex: publicKeyHex,
  });

  return {
    version: 1,
    exportedAtUnixMs: Date.now(),
    profileId,
    profileLabel: params.profileLabel,
    publicKeyHex,
    includesVaultMedia: Boolean(params.includeVaultMedia),
    workspaceArchive,
    networkSnapshot: {
      chatStateKeys: chatState ? Object.keys(chatState.groupMessages ?? {}) : [],
      chatStateJson: chatState ? JSON.stringify(chatState) : null,
      membershipLedgerJson: JSON.stringify(loadCommunityMembershipLedger(publicKeyHex, { profileId })),
      blocklistJson: readScopedStorageValue("dweb.nostr.pwa.blocklist", profileId),
      contactOutboxJson: readScopedStorageValue("obscur.contact_request_outbox", profileId),
    },
    settingsSnapshot: {
      themePreference: loadThemePreference(profileId),
      privacySettingsJson: JSON.stringify(PrivacySettingsService.getSettings()),
      uiSettingsJson: readScopedStorageValue("obscur.ui.settings", profileId),
      localMediaConfigJson: JSON.stringify(getLocalMediaStorageConfig(profileId)),
    },
    vaultMediaFiles: await collectVaultMediaFiles({
      includeVaultMedia: Boolean(params.includeVaultMedia),
      maxVaultFileBytes: params.maxVaultFileBytes ?? DEFAULT_MAX_VAULT_FILE_BYTES,
      maxVaultTotalBytes: params.maxVaultTotalBytes ?? DEFAULT_MAX_VAULT_TOTAL_BYTES,
    }),
  };
};

export const createEncryptedWorkspaceBundleEnvelope = async (
  params: EncryptedWorkspaceBundleExportOptions,
): Promise<EncryptedWorkspaceBundleEnvelope> => {
  const payload = await buildEncryptedWorkspaceBundlePayload(params);
  const plaintext = JSON.stringify(payload);
  const compressed = await compressText(plaintext);
  const ciphertext = await cryptoService.encryptDM(
    compressed,
    params.publicKeyHex as PublicKeyHex,
    params.privateKeyHex as PrivateKeyHex,
  );
  return {
    version: 1,
    format: ENCRYPTED_WORKSPACE_BUNDLE_FORMAT,
    profileId: payload.profileId,
    publicKeyHex: payload.publicKeyHex,
    exportedAtUnixMs: payload.exportedAtUnixMs,
    compression: "gzip+base64",
    ciphertext,
  };
};

export const parseEncryptedWorkspaceBundleEnvelope = (raw: unknown): EncryptedWorkspaceBundleEnvelope | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = raw as Partial<EncryptedWorkspaceBundleEnvelope>;
  if (
    candidate.version !== 1
    || candidate.format !== ENCRYPTED_WORKSPACE_BUNDLE_FORMAT
    || typeof candidate.profileId !== "string"
    || typeof candidate.publicKeyHex !== "string"
    || typeof candidate.ciphertext !== "string"
    || candidate.compression !== "gzip+base64"
  ) {
    return null;
  }
  return candidate as EncryptedWorkspaceBundleEnvelope;
};

export const decryptEncryptedWorkspaceBundlePayload = async (params: Readonly<{
  envelope: EncryptedWorkspaceBundleEnvelope;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
}>): Promise<EncryptedWorkspaceBundlePayload> => {
  const decrypted = await cryptoService.decryptDM(
    params.envelope.ciphertext,
    params.publicKeyHex,
    params.privateKeyHex,
  );
  const plaintext = await decompressText(decrypted, params.envelope.compression);
  const parsed = JSON.parse(plaintext) as EncryptedWorkspaceBundlePayload;
  if (parsed.publicKeyHex !== params.publicKeyHex) {
    throw new Error("Encrypted workspace bundle belongs to a different account.");
  }
  return parsed;
};


export const exportEncryptedWorkspaceBundle = async (
  params: EncryptedWorkspaceBundleExportOptions,
): Promise<Readonly<{ fileName: string; absolutePath: string | null; downloadTriggered: boolean }>> => {
  const envelope = await createEncryptedWorkspaceBundleEnvelope(params);
  const fileName = params.fileName?.trim()
    || `${params.profileId}__workspace__${new Date(envelope.exportedAtUnixMs).toISOString().replace(/[:.]/g, "-")}.obscur-bundle`;
  const serialized = JSON.stringify(envelope, null, 2);

  const writeResult = await writeExportToDataRoot(fileName, serialized);
  if (writeResult.absolutePath) {
    logAppEvent({
      name: "profiles.encrypted_workspace_bundle_exported",
      level: "info",
      scope: { feature: "profiles", action: "workspace_bundle" },
      context: {
        profileId: params.profileId,
        includeVaultMedia: Boolean(params.includeVaultMedia),
        absolutePath: writeResult.absolutePath,
      },
    });
  }
  return {
    fileName: writeResult.fileName,
    absolutePath: writeResult.absolutePath,
    downloadTriggered: writeResult.downloadTriggered,
  };
};

export const importEncryptedWorkspaceBundle = async (params: Readonly<{
  envelope: EncryptedWorkspaceBundleEnvelope;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  profileId?: string;
}>): Promise<EncryptedWorkspaceBundlePayload> => {
  const payload = await decryptEncryptedWorkspaceBundlePayload(params);
  const profileId = params.profileId?.trim() || getResolvedProfileId();

  if (typeof window !== "undefined" && payload.workspaceArchive) {
    const { importProfileWorkspaceArchiveIntoScope, parseProfileWorkspaceArchive } = await import("./profile-workspace-archive-service");
    const archive = parseProfileWorkspaceArchive(payload.workspaceArchive);
    if (archive) {
      importProfileWorkspaceArchiveIntoScope(archive, profileId);
    }
  }

  if (typeof window !== "undefined") {
    const writeScoped = (baseKey: string, value: string | null): void => {
      if (!value) return;
      window.localStorage.setItem(getScopedStorageKey(baseKey, profileId), value);
    };
    writeScoped("dweb.nostr.pwa.blocklist", payload.networkSnapshot.blocklistJson);
    writeScoped("obscur.contact_request_outbox", payload.networkSnapshot.contactOutboxJson);
    if (payload.networkSnapshot.chatStateJson) {
      try {
        const chatState = JSON.parse(payload.networkSnapshot.chatStateJson);
        savePersistedChatState(chatState, params.publicKeyHex, { profileId });
      } catch {
        // Ignore malformed chat-state snapshots.
      }
    }
    if (payload.networkSnapshot.membershipLedgerJson) {
      try {
        const entries = JSON.parse(payload.networkSnapshot.membershipLedgerJson);
        if (Array.isArray(entries)) {
          replaceCommunityMembershipLedger(params.publicKeyHex, entries, { profileId });
        }
      } catch {
        // Ignore malformed ledger snapshots.
      }
    }
    if (payload.settingsSnapshot.localMediaConfigJson) {
      writeScoped("obscur.vault.local_media_storage_config", payload.settingsSnapshot.localMediaConfigJson);
    }
  }

  if (payload.vaultMediaFiles && hasNativeRuntime()) {
    const storageRoot = await getLocalMediaStorageAbsolutePath();
    if (storageRoot) {
      for (const file of payload.vaultMediaFiles) {
        const targetPath = await nativeLocalMediaAdapter.joinPaths(storageRoot, file.relativePath);
        const parent = targetPath.replace(/[\\/][^\\/]+$/, "");
        await nativeLocalMediaAdapter.ensureDirectory({ path: parent });
        await nativeLocalMediaAdapter.writeBytes({
          path: targetPath,
          bytes: base64ToBytes(file.contentBase64),
        });
      }
    }
  }

  return payload;
};
