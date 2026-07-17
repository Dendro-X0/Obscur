import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import { lesKindFromFile } from "./les-kind-from-file";
import {
  commitLesObjectWithProof,
  type LesCommitReceipt,
} from "./les-native-sdk";

export type LesSecureUploadResult = Readonly<{
  receipts: ReadonlyArray<LesCommitReceipt>;
  failedNames: ReadonlyArray<string>;
}>;

/**
 * Secure Upload → Rust LES only. Does not touch the legacy vault store.
 * Success count requires catalog proof per file.
 */
export const uploadFilesToLes = async (files: ReadonlyArray<File>): Promise<LesSecureUploadResult> => {
  const profileId = resolveVaultProfileId().trim() || undefined;
  const receipts: LesCommitReceipt[] = [];
  const failedNames: string[] = [];

  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength === 0) {
        failedNames.push(file.name || "file");
        continue;
      }
      const receipt = await commitLesObjectWithProof({
        profileId,
        bytes,
        kind: lesKindFromFile(file),
        displayName: file.name?.trim() || "file",
        contentType: file.type?.trim() || "application/octet-stream",
        source: "secure_upload",
      });
      receipts.push(receipt);
    } catch (error) {
      console.error("[LES] Secure Upload failed:", file.name, error);
      failedNames.push(file.name || "file");
      if (error instanceof Error && /Unlock this profile/i.test(error.message)) {
        throw error;
      }
    }
  }

  return { receipts, failedNames };
};
