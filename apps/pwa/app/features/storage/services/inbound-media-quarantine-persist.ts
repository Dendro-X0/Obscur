/**
 * P2-S S2b — native AppData persist for inbound quarantine paths.
 * Writes only under profiles/{id}/quarantine/{sha256}. Never shell-opens.
 *
 * @see specs/backend/sandboxed-storage-security-design-2026-11.md
 */

import { nativeLocalMediaAdapter } from "@/app/features/vault/services/native-local-media-adapter";
import {
  buildProfileQuarantineRelativeDir,
  relativePathBelongsToProfileQuarantine,
  type InboundMediaWritePlan,
} from "./inbound-media-quarantine";

export type PersistInboundMediaQuarantineParams = Readonly<{
  profileId: string;
  plan: InboundMediaWritePlan;
  bytes: Uint8Array;
}>;

export type PersistInboundMediaQuarantineResult =
  | Readonly<{ status: "written"; relativePath: string }>
  | Readonly<{ status: "skipped_non_native" }>
  | Readonly<{ status: "rejected_path"; reason: string }>
  | Readonly<{ status: "failed"; reason: string }>;

/**
 * Persist inbound bytes to the planned quarantine relative path under AppData.
 * Fail-closed on path membership. No OS “open with”.
 */
export const persistInboundMediaQuarantineBytes = async (
  params: PersistInboundMediaQuarantineParams,
): Promise<PersistInboundMediaQuarantineResult> => {
  const relativePath = params.plan.quarantineRelativePath;
  if (
    !relativePath
    || !relativePathBelongsToProfileQuarantine(relativePath, params.profileId)
  ) {
    return { status: "rejected_path", reason: "path_not_in_profile_quarantine" };
  }

  if (!nativeLocalMediaAdapter.isSupported()) {
    return { status: "skipped_non_native" };
  }

  try {
    const dir = buildProfileQuarantineRelativeDir(params.profileId);
    const dirOk = await nativeLocalMediaAdapter.ensureDirectory({
      path: dir,
      appDataRelative: true,
    });
    if (!dirOk) {
      return { status: "failed", reason: "ensure_directory_failed" };
    }

    const written = await nativeLocalMediaAdapter.writeBytes({
      path: relativePath,
      appDataRelative: true,
      bytes: params.bytes,
    });
    if (!written) {
      return { status: "failed", reason: "write_failed" };
    }
    return { status: "written", relativePath };
  } catch {
    return { status: "failed", reason: "write_threw" };
  }
};

export type ReadInboundMediaQuarantineParams = Readonly<{
  /** Active profile requesting the read — must own the quarantine path. */
  requestingProfileId: string;
  relativePath: string;
}>;

/**
 * Read quarantine bytes only when the path belongs to requestingProfileId.
 * Cross-profile paths return null (S5 L1 negative).
 */
export const readInboundMediaQuarantineBytes = async (
  params: ReadInboundMediaQuarantineParams,
): Promise<Uint8Array | null> => {
  if (!relativePathBelongsToProfileQuarantine(
    params.relativePath,
    params.requestingProfileId,
  )) {
    return null;
  }
  if (!nativeLocalMediaAdapter.isSupported()) {
    return null;
  }
  return nativeLocalMediaAdapter.readBytes({
    path: params.relativePath,
    appDataRelative: true,
  });
};
