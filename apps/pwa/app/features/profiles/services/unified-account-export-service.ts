import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PortableAccountBundle } from "@/app/features/account-sync/account-sync-contracts";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { wipeProfileWorkspaceCompletely } from "@/app/features/profiles/services/wipe-profile-workspace";
import { writeExportToDataRoot } from "@/app/features/profiles/services/data-root-export-service";
import {
  createEncryptedWorkspaceBundleEnvelope,
  importEncryptedWorkspaceBundle,
  parseEncryptedWorkspaceBundleEnvelope,
} from "./encrypted-workspace-bundle-service";
import {
  UNIFIED_ACCOUNT_EXPORT_FORMAT,
  type UnifiedAccountExportEnvelope,
} from "./unified-account-export-contracts";

const PORTABLE_ACCOUNT_BUNDLE_FORMAT = "obscur.portable_account_bundle.v1";

const parsePortableAccountBundleEnvelope = (value: unknown): PortableAccountBundle | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const parsed = value as Partial<PortableAccountBundle>;
  if (
    parsed.version !== 1
    || parsed.format !== PORTABLE_ACCOUNT_BUNDLE_FORMAT
    || typeof parsed.publicKeyHex !== "string"
    || typeof parsed.ciphertext !== "string"
    || typeof parsed.exportedAtUnixMs !== "number"
  ) {
    return null;
  }
  return parsed as PortableAccountBundle;
};

export const parseUnifiedAccountExportEnvelope = (raw: unknown): UnifiedAccountExportEnvelope | null => {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = raw as Partial<UnifiedAccountExportEnvelope>;
  if (
    candidate.version !== 1
    || candidate.format !== UNIFIED_ACCOUNT_EXPORT_FORMAT
    || typeof candidate.exportedAtUnixMs !== "number"
    || typeof candidate.publicKeyHex !== "string"
    || !candidate.portableAccountBundle
  ) {
    return null;
  }
  const portableAccountBundle = parsePortableAccountBundleEnvelope(candidate.portableAccountBundle);
  if (!portableAccountBundle) {
    return null;
  }
  const workspaceBundle = candidate.workspaceBundle === null || candidate.workspaceBundle === undefined
    ? null
    : parseEncryptedWorkspaceBundleEnvelope(candidate.workspaceBundle);
  if (candidate.workspaceBundle != null && !workspaceBundle) {
    return null;
  }
  return {
    version: 1,
    format: UNIFIED_ACCOUNT_EXPORT_FORMAT,
    exportedAtUnixMs: candidate.exportedAtUnixMs,
    publicKeyHex: candidate.publicKeyHex,
    profileLabel: candidate.profileLabel,
    portableAccountBundle,
    workspaceBundle,
    manifest: {
      includesVaultMedia: Boolean(candidate.manifest?.includesVaultMedia),
      portableEstimatedBytes: candidate.manifest?.portableEstimatedBytes ?? 0,
      workspaceEstimatedBytes: candidate.manifest?.workspaceEstimatedBytes ?? null,
    },
  };
};

/** Accepts unified export or legacy portable-only JSON. */
export const parsePortableOrUnifiedImportEnvelope = (
  raw: unknown,
): Readonly<{ kind: "unified"; envelope: UnifiedAccountExportEnvelope } | { kind: "portable"; bundle: PortableAccountBundle }> | null => {
  const unified = parseUnifiedAccountExportEnvelope(raw);
  if (unified) {
    return { kind: "unified", envelope: unified };
  }
  const portable = parsePortableAccountBundleEnvelope(raw);
  if (portable) {
    return { kind: "portable", bundle: portable };
  }
  return null;
};

export const exportUnifiedAccountBundle = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  profileId?: string;
  profileLabel?: string;
  includeVaultMedia?: boolean;
}>): Promise<Readonly<{
  envelope: UnifiedAccountExportEnvelope;
  serialized: string;
}>> => {
  const profileId = params.profileId?.trim() || getResolvedProfileId();
  const { bundle: portableAccountBundle } = await encryptedAccountBackupService.exportPortableAccountBundle({
    publicKeyHex: params.publicKeyHex,
    privateKeyHex: params.privateKeyHex,
    profileLabel: params.profileLabel,
  });

  const includeVaultMedia = Boolean(params.includeVaultMedia);
  const workspaceBundle = includeVaultMedia
    ? await createEncryptedWorkspaceBundleEnvelope({
      profileId,
      profileLabel: params.profileLabel,
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      includeVaultMedia: true,
    })
    : null;

  const portableSerialized = JSON.stringify(portableAccountBundle);
  const workspaceSerialized = workspaceBundle ? JSON.stringify(workspaceBundle) : null;
  const exportedAtUnixMs = Math.max(
    portableAccountBundle.exportedAtUnixMs,
    workspaceBundle?.exportedAtUnixMs ?? 0,
  );

  const envelope: UnifiedAccountExportEnvelope = {
    version: 1,
    format: UNIFIED_ACCOUNT_EXPORT_FORMAT,
    exportedAtUnixMs,
    publicKeyHex: params.publicKeyHex,
    profileLabel: params.profileLabel,
    portableAccountBundle,
    workspaceBundle,
    manifest: {
      includesVaultMedia: includeVaultMedia,
      portableEstimatedBytes: portableSerialized.length,
      workspaceEstimatedBytes: workspaceSerialized?.length ?? null,
    },
  };

  return {
    envelope,
    serialized: JSON.stringify(envelope, null, 2),
  };
};

export const importUnifiedAccountBundle = async (params: Readonly<{
  raw: unknown;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  profileId?: string;
}>): Promise<Readonly<{
  kind: "unified" | "portable";
  importedWorkspace: boolean;
}>> => {
  const parsed = parsePortableOrUnifiedImportEnvelope(params.raw);
  if (!parsed) {
    throw new Error("File is not a valid unified account export or portable bundle.");
  }

  const profileId = params.profileId?.trim() || getResolvedProfileId();
  const appendCanonicalEvents = accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime);

  await wipeProfileWorkspaceCompletely({
    profileId,
    publicKeyHex: params.publicKeyHex,
  });

  if (parsed.kind === "portable") {
    await encryptedAccountBackupService.importPortableAccountBundle({
      bundle: parsed.bundle,
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      profileId,
      appendCanonicalEvents,
    });
    return { kind: "portable", importedWorkspace: false };
  }

  const { envelope } = parsed;
  if (envelope.publicKeyHex !== params.publicKeyHex) {
    throw new Error("Unified export belongs to a different account than the one unlocked in this window.");
  }

  await encryptedAccountBackupService.importPortableAccountBundle({
    bundle: envelope.portableAccountBundle,
    publicKeyHex: params.publicKeyHex,
    privateKeyHex: params.privateKeyHex,
    profileId,
    appendCanonicalEvents,
  });

  if (envelope.workspaceBundle) {
    await importEncryptedWorkspaceBundle({
      envelope: envelope.workspaceBundle,
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      profileId,
    });
  }

  return {
    kind: "unified",
    importedWorkspace: envelope.workspaceBundle !== null,
  };
};

export const writeUnifiedAccountExportToDataRoot = async (params: Readonly<{
  fileName: string;
  envelope: UnifiedAccountExportEnvelope;
}>): Promise<Readonly<{ fileName: string; absolutePath: string | null; downloadTriggered: boolean }>> => {
  const serialized = JSON.stringify(params.envelope, null, 2);
  const writeResult = await writeExportToDataRoot(params.fileName, serialized);
  const { writeObscurLocalSaveSidecarForExport } = await import("./local-save-sidecar");
  await writeObscurLocalSaveSidecarForExport({
    publicKeyHex: params.envelope.publicKeyHex as PublicKeyHex,
    profileLabel: params.envelope.profileLabel,
    exportedAtUnixMs: params.envelope.exportedAtUnixMs,
    payloadFileName: params.fileName,
    payloadFormat: params.envelope.format,
    payloadBytes: serialized.length,
  }).catch(() => {
    // Export file is authoritative; sidecar is a scan hint only.
  });
  return writeResult;
};

export const writePortableAccountExportToDataRoot = async (params: Readonly<{
  fileName: string;
  bundle: PortableAccountBundle;
}>): Promise<Readonly<{ fileName: string; absolutePath: string | null; downloadTriggered: boolean }>> => {
  const serialized = JSON.stringify(params.bundle, null, 2);
  const writeResult = await writeExportToDataRoot(params.fileName, serialized);
  const { writeObscurLocalSaveSidecarForExport } = await import("./local-save-sidecar");
  await writeObscurLocalSaveSidecarForExport({
    publicKeyHex: params.bundle.publicKeyHex as PublicKeyHex,
    profileLabel: params.bundle.profileLabel,
    exportedAtUnixMs: params.bundle.exportedAtUnixMs,
    payloadFileName: params.fileName,
    payloadFormat: params.bundle.format,
    payloadBytes: serialized.length,
  }).catch(() => {
    // Export file is authoritative; sidecar is a scan hint only.
  });
  return writeResult;
};
