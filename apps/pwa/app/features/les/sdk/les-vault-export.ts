import { nativeLocalMediaAdapter } from "@/app/features/vault/services/native-local-media-adapter";
import { getObscurDataRootConfig } from "@/app/features/profiles/services/obscur-data-root-service";
import type { VaultMediaItem } from "@/app/features/vault/types/vault-media-item";
import { parseLesRemoteUrl } from "./les-vault-media-adapter";
import { readLesObjectDecrypted } from "./les-native-sdk";

/** Export plaintext bytes from LES via the existing save-dialog adapter (not local-media-store index). */
export const exportLesVaultItemToUserPath = async (item: VaultMediaItem): Promise<boolean> => {
  const parsed = parseLesRemoteUrl(item.remoteUrl);
  if (!parsed) {
    return false;
  }
  const bytes = await readLesObjectDecrypted(parsed.lesObjectId, parsed.profileId);
  if (bytes.byteLength === 0) {
    return false;
  }
  const fileName = item.attachment.fileName?.trim() || `${parsed.lesObjectId}.bin`;
  const targetPath = await nativeLocalMediaAdapter.pickSavePath({ defaultPath: fileName });
  if (!targetPath) {
    return false;
  }
  await nativeLocalMediaAdapter.writeBytes({ path: targetPath, bytes });
  return true;
};

export const revealLesVaultItemFolder = async (item: VaultMediaItem): Promise<boolean> => {
  const relative = item.localRelativePath?.trim();
  if (!relative) {
    return false;
  }
  try {
    const config = await getObscurDataRootConfig();
    const root = config.effectivePath?.trim();
    if (!root) {
      return false;
    }
    const absolute = await nativeLocalMediaAdapter.joinPaths(root, relative);
    const parent = await nativeLocalMediaAdapter.parentPath(absolute);
    if (!parent) {
      return false;
    }
    return nativeLocalMediaAdapter.openPath(parent);
  } catch {
    return false;
  }
};
