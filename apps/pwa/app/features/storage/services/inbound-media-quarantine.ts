/**
 * P2-S S2 — per-profile quarantine paths + inbound write plan (Storage plane).
 * Paths are AppData-relative. Native FS persist: inbound-media-quarantine-persist (S2b).
 *
 * @see specs/backend/sandboxed-storage-security-design-2026-11.md
 */

import { sanitizeProfileVaultId } from "@/app/features/vault/services/local-media-vault-path";
import {
  evaluateInboundMediaPolicy,
  type InboundMediaPolicyDecision,
  type InboundMediaPolicyInput,
} from "./inbound-media-policy";

export const PROFILE_QUARANTINE_PARENT_DIR = "profiles";
export const PROFILE_QUARANTINE_SUBDIR = "quarantine";

const normalizeRelativePath = (relativePath: string): string =>
  relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();

/** Object id under quarantine: hex digest only (no path segments). */
export const sanitizeQuarantineObjectId = (sha256: string): string | null => {
  const id = sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{16,128}$/.test(id)) {
    return null;
  }
  return id;
};

export const buildProfileQuarantineRelativeDir = (profileId: string): string =>
  `${PROFILE_QUARANTINE_PARENT_DIR}/${sanitizeProfileVaultId(profileId)}/${PROFILE_QUARANTINE_SUBDIR}`;

/**
 * Fail-closed path for inbound bytes: `profiles/{id}/quarantine/{sha256}`.
 * Returns null if profile/object id unsafe.
 */
export const buildProfileQuarantineRelativePath = (
  profileId: string,
  sha256: string,
): string | null => {
  const objectId = sanitizeQuarantineObjectId(sha256);
  if (!objectId) {
    return null;
  }
  const sanitizedProfile = sanitizeProfileVaultId(profileId);
  if (!sanitizedProfile || sanitizedProfile.includes("..")) {
    return null;
  }
  return `${buildProfileQuarantineRelativeDir(profileId)}/${objectId}`;
};

export const isProfileScopedQuarantineRelativePath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  return normalized.startsWith(`${PROFILE_QUARANTINE_PARENT_DIR}/`)
    && normalized.includes(`/${PROFILE_QUARANTINE_SUBDIR}/`);
};

/** Reject traversal / absolute / wrong profile. */
export const relativePathBelongsToProfileQuarantine = (
  relativePath: string,
  profileId: string,
): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || normalized.includes("..") || /^[a-zA-Z]:/.test(normalized) || normalized.startsWith("/")) {
    return false;
  }
  if (!isProfileScopedQuarantineRelativePath(normalized)) {
    return false;
  }
  const expectedPrefix = `${buildProfileQuarantineRelativeDir(profileId)}/`.toLowerCase();
  const lower = `${normalized.toLowerCase()}/`;
  return lower.startsWith(expectedPrefix);
};

export type InboundMediaWritePlan = Readonly<{
  policy: InboundMediaPolicyDecision;
  quarantineRelativePath: string | null;
  allowPreview: boolean;
  /** Maps onto CommunityMediaDescriptor.contentAvailabilityState */
  contentAvailabilityState: "available" | "quarantined";
  /** Never auto-open with OS / shell */
  allowSystemOpen: false;
}>;

export type PlanInboundMediaWriteParams = InboundMediaPolicyInput & Readonly<{
  profileId: string;
  sha256: string;
}>;

/**
 * Single gate for inbound attachment bytes: policy + quarantine path + no system-open.
 */
export const planInboundMediaWrite = (
  params: PlanInboundMediaWriteParams,
): InboundMediaWritePlan => {
  const policy = evaluateInboundMediaPolicy({
    mimeType: params.mimeType,
    fileName: params.fileName,
    byteLength: params.byteLength,
    maxBytes: params.maxBytes,
  });
  const quarantineRelativePath = buildProfileQuarantineRelativePath(
    params.profileId,
    params.sha256,
  );
  const pathOk = quarantineRelativePath !== null
    && relativePathBelongsToProfileQuarantine(quarantineRelativePath, params.profileId);

  if (!pathOk) {
    return {
      policy: {
        ok: false,
        action: "deny",
        reason: "missing_type",
        detail: "invalid_quarantine_path",
      },
      quarantineRelativePath: null,
      allowPreview: false,
      contentAvailabilityState: "quarantined",
      allowSystemOpen: false,
    };
  }

  return {
    policy,
    quarantineRelativePath,
    allowPreview: policy.ok === true,
    contentAvailabilityState: policy.ok ? "available" : "quarantined",
    allowSystemOpen: false,
  };
};
